#include "PuertsHttpClient.h"

#include "Async/Async.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace
{
    /** 构造同步失败时的错误响应 (如 URL 为空、HeadersJson 非法). */
    FPuertsHttpResponse MakeErrorResponse(int32 RequestId, const FString& ErrorMessage)
    {
        FPuertsHttpResponse Response;
        Response.RequestId = RequestId;
        Response.bSucceeded = false;
        Response.HeadersJson = TEXT("{}");
        Response.ErrorMessage = ErrorMessage;
        return Response;
    }

    const TCHAR* GetHttpRequestStatusName(EHttpRequestStatus::Type Status)
    {
        switch (Status)
        {
        case EHttpRequestStatus::NotStarted:
            return TEXT("NotStarted");
        case EHttpRequestStatus::Processing:
            return TEXT("Processing");
        case EHttpRequestStatus::Failed:
            return TEXT("Failed");
        case EHttpRequestStatus::Succeeded:
            return TEXT("Succeeded");
        default:
            return TEXT("Unknown");
        }
    }

    /**
     * 将 HeadersJson 解析为请求头并写入 IHttpRequest.
     * @return false 时 OutErrorMessage 携带可读错误, Send 会同步回调并返回 0.
     */
    bool ApplyHeadersFromJson(
        const FString& HeadersJson,
        const TSharedRef<IHttpRequest, ESPMode::ThreadSafe>& Request,
        FString& OutErrorMessage
    )
    {
        if (HeadersJson.IsEmpty())
        {
            return true;
        }

        TSharedPtr<FJsonObject> HeadersObject;
        const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(HeadersJson);
        if (!FJsonSerializer::Deserialize(Reader, HeadersObject) || !HeadersObject.IsValid())
        {
            OutErrorMessage = TEXT("HeadersJson must be a valid JSON object.");
            return false;
        }

        for (const TPair<FString, TSharedPtr<FJsonValue>>& HeaderPair : HeadersObject->Values)
        {
            FString HeaderValue;
            if (!HeaderPair.Value.IsValid() || !HeaderPair.Value->TryGetString(HeaderValue))
            {
                OutErrorMessage = FString::Printf(TEXT("Header '%s' must be a string value."), *HeaderPair.Key);
                return false;
            }

            Request->SetHeader(HeaderPair.Key, HeaderValue);
        }

        return true;
    }

    /** 将 IHttpResponse 响应头序列化为 JSON 对象字符串, 供 TypeScript parseHeadersJson 解析. */
    FString HeadersToJson(const FHttpResponsePtr& Response)
    {
        if (!Response.IsValid())
        {
            return TEXT("{}");
        }

        const TSharedRef<FJsonObject> HeadersObject = MakeShared<FJsonObject>();
        for (const FString& HeaderLine : Response->GetAllHeaders())
        {
            FString HeaderName;
            FString HeaderValue;
            if (!HeaderLine.Split(TEXT(":"), &HeaderName, &HeaderValue))
            {
                continue;
            }

            HeadersObject->SetStringField(HeaderName.TrimStartAndEnd(), HeaderValue.TrimStartAndEnd());
        }

        FString Output;
        const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Output);
        FJsonSerializer::Serialize(HeadersObject, Writer);
        return Output;
    }
}

int32 UPuertsHttpClient::Send(const FPuertsHttpRequestOptions& Options, const FPuertsHttpResponseDelegate& Callback)
{
    if (Options.Url.IsEmpty())
    {
        Callback.ExecuteIfBound(MakeErrorResponse(0, TEXT("Request URL is empty.")));
        return 0;
    }

    const int32 RequestId = AllocateRequestId();
    const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();

    FString HeaderErrorMessage;
    if (!ApplyHeadersFromJson(Options.HeadersJson, Request, HeaderErrorMessage))
    {
        Callback.ExecuteIfBound(MakeErrorResponse(RequestId, HeaderErrorMessage));
        return 0;
    }

    FString Verb = Options.Verb.IsEmpty() ? TEXT("GET") : Options.Verb;
    Verb.ToUpperInline();

    Request->SetURL(Options.Url);
    Request->SetVerb(Verb);

    if (!Options.Body.IsEmpty())
    {
        Request->SetContentAsString(Options.Body);
    }

    if (Options.TimeoutSeconds > 0.0f)
    {
        Request->SetTimeout(Options.TimeoutSeconds);
    }

    Request->OnProcessRequestComplete().BindUObject(this, &UPuertsHttpClient::HandleRequestComplete, RequestId);

    PendingRequests.Add(RequestId, FPendingRequest{ Request, Callback });

    if (!Request->ProcessRequest())
    {
        PendingRequests.Remove(RequestId);
        Callback.ExecuteIfBound(MakeErrorResponse(RequestId, TEXT("Failed to start HTTP request.")));
        return 0;
    }

    return RequestId;
}

bool UPuertsHttpClient::Cancel(int32 RequestId)
{
    FPendingRequest* PendingRequest = PendingRequests.Find(RequestId);
    if (!PendingRequest)
    {
        return false;
    }

    if (PendingRequest->Request.IsValid())
    {
        // 先解绑再 Cancel, 避免 Cancel 后仍触发 HandleRequestComplete.
        PendingRequest->Request->OnProcessRequestComplete().Unbind();
        PendingRequest->Request->CancelRequest();
    }

    PendingRequests.Remove(RequestId);
    return true;
}

void UPuertsHttpClient::CancelAll()
{
    TArray<int32> RequestIds;
    PendingRequests.GetKeys(RequestIds);

    for (const int32 RequestId : RequestIds)
    {
        Cancel(RequestId);
    }
}

void UPuertsHttpClient::BeginDestroy()
{
    // UObject 销毁前清理未完成请求, 防止回调落到已释放的 JS 侧.
    CancelAll();
    Super::BeginDestroy();
}

int32 UPuertsHttpClient::AllocateRequestId()
{
    return NextRequestId++;
}

void UPuertsHttpClient::HandleRequestComplete(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bWasSuccessful,
    int32 RequestId
)
{
    FPendingRequest PendingRequest;
    if (!PendingRequests.RemoveAndCopyValue(RequestId, PendingRequest))
    {
        // 已被 Cancel 移除, 忽略迟到的完成回调.
        return;
    }

    FPuertsHttpResponse PuertsResponse;
    PuertsResponse.RequestId = RequestId;
    PuertsResponse.bSucceeded = bWasSuccessful && Response.IsValid();
    PuertsResponse.StatusCode = Response.IsValid() ? Response->GetResponseCode() : 0;
    PuertsResponse.Body = Response.IsValid() ? Response->GetContentAsString() : FString();
    PuertsResponse.HeadersJson = HeadersToJson(Response);

    if (!PuertsResponse.bSucceeded)
    {
        const EHttpRequestStatus::Type RequestStatus = Request.IsValid()
            ? Request->GetStatus()
            : EHttpRequestStatus::Failed;
        PuertsResponse.ErrorMessage = FString::Printf(
            TEXT("HTTP request failed. Status=%s, ResponseValid=%s, ResponseCode=%d"),
            GetHttpRequestStatusName(RequestStatus),
            Response.IsValid() ? TEXT("true") : TEXT("false"),
            PuertsResponse.StatusCode
        );
    }

    // Puerts 回调会进入 JS VM, 必须回到 Game Thread, 避免平台 HTTP 线程直接调用脚本.
    const TWeakObjectPtr<UPuertsHttpClient> WeakThis(this);
    AsyncTask(ENamedThreads::GameThread, [WeakThis, Callback = PendingRequest.Callback, PuertsResponse]() mutable {
        if (!WeakThis.IsValid())
        {
            return;
        }

        Callback.ExecuteIfBound(PuertsResponse);
    });
}
