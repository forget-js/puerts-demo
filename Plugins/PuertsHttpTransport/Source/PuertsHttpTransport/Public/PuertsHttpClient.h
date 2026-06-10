#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"

#include "PuertsHttpClient.generated.h"

/**
 * Puerts HTTP 传输层请求参数.
 *
 * Headers 以 JSON 对象字符串传递, 便于 Puerts / 蓝图反射 API 保持稳定,
 * 避免 TMap 等复杂类型在跨语言绑定与项目迁移时频繁变动.
 */
USTRUCT(BlueprintType)
struct PUERTSHTTPTRANSPORT_API FPuertsHttpRequestOptions
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "Puerts HTTP")
    FString Url;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "Puerts HTTP")
    FString Verb = TEXT("GET");

    /** JSON 对象字符串, 键值均为 string, 例如 {"Authorization":"Bearer ..."}. */
    UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "Puerts HTTP")
    FString HeadersJson;

    UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "Puerts HTTP")
    FString Body;

    /** 0 表示使用 UE HTTP 模块默认超时. */
    UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "Puerts HTTP")
    float TimeoutSeconds = 0.0f;
};

/** UE HTTP 模块返回的传输层响应; 业务错误码解析在 TypeScript HttpClient 中处理. */
USTRUCT(BlueprintType)
struct PUERTSHTTPTRANSPORT_API FPuertsHttpResponse
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    int32 RequestId = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    int32 StatusCode = 0;

    /** 网络层是否成功收到响应; HTTP 4xx/5xx 时仍可能为 true. */
    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    bool bSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    bool bCanceled = false;

    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    FString ErrorMessage;

    /** 响应头 JSON 对象字符串, 与 FPuertsHttpRequestOptions.HeadersJson 格式一致. */
    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    FString HeadersJson;

    UPROPERTY(BlueprintReadOnly, Category = "Puerts HTTP")
    FString Body;
};

DECLARE_DYNAMIC_DELEGATE_OneParam(FPuertsHttpResponseDelegate, const FPuertsHttpResponse&, Response);

/**
 * 封装 UE FHttpModule 的可复用 UObject 桥接层.
 *
 * 仅暴露传输原语; baseUrl、鉴权、重试与业务错误处理
 * 由 TypeScript Runtime/Http 层 (HttpClient / UnrealHttpTransport) 负责.
 */
UCLASS(BlueprintType)
class PUERTSHTTPTRANSPORT_API UPuertsHttpClient : public UObject
{
    GENERATED_BODY()

public:
    /** 发起请求; 成功排队返回正数 RequestId, 无法启动时返回 0 并同步触发 Callback. */
    UFUNCTION(BlueprintCallable, Category = "Puerts HTTP")
    int32 Send(const FPuertsHttpRequestOptions& Options, const FPuertsHttpResponseDelegate& Callback);

    /** 取消进行中的请求; 成功取消后不再触发 Callback. */
    UFUNCTION(BlueprintCallable, Category = "Puerts HTTP")
    bool Cancel(int32 RequestId);

    /** 取消本 Client 持有的全部未完成请求. */
    UFUNCTION(BlueprintCallable, Category = "Puerts HTTP")
    void CancelAll();

    virtual void BeginDestroy() override;

private:
    /** 进行中的请求上下文: IHttpRequest 与完成回调. */
    struct FPendingRequest
    {
        TSharedPtr<class IHttpRequest, ESPMode::ThreadSafe> Request;
        FPuertsHttpResponseDelegate Callback;
    };

    int32 NextRequestId = 1;
    TMap<int32, FPendingRequest> PendingRequests;

    int32 AllocateRequestId();
    void HandleRequestComplete(
        TSharedPtr<class IHttpRequest, ESPMode::ThreadSafe> Request,
        TSharedPtr<class IHttpResponse, ESPMode::ThreadSafe> Response,
        bool bWasSuccessful,
        int32 RequestId
    );
};
