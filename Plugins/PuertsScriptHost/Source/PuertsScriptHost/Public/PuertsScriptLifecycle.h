#pragma once

#include "CoreMinimal.h"
#include "JsObject.h"
#include "UObject/Object.h"
#include "PuertsScriptLifecycle.generated.h"

/**
 * C++ 与 TypeScript 之间的脚本关闭桥接.
 *
 * TS 在启动完成后调用 BindShutdown, 注册一个无参函数;
 * Subsystem::Deinitialize 时通过 InvokeShutdown 触发 stop/dispose.
 */
UCLASS()
class PUERTSSCRIPTHOST_API UPuertsScriptLifecycle : public UObject
{
    GENERATED_BODY()

public:
    /** 由 TS 绑定 shutdown 回调; 可重复调用, 以后一次为准. */
    UFUNCTION(BlueprintCallable, Category = "Puerts Script Host")
    void BindShutdown(const FJsObject& Callback);

    /** 由宿主 Subsystem 在 JsEnv 销毁前调用. */
    void InvokeShutdown();

    /** 是否已绑定 shutdown 回调 (由 BindShutdown 设置). */
    bool HasShutdownCallback() const { return bShutdownBound; }

private:
    FJsObject ShutdownCallback;
    bool bShutdownBound = false;
};
