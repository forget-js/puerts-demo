#pragma once

#include "CoreMinimal.h"
#include "JsObject.h"
#include "UObject/Object.h"
#include "PuertsScriptLifecycle.generated.h"

/**
 * C++ 与 TypeScript 之间的脚本生命周期桥接.
 *
 * TS 在启动完成后调用 BindShutdown / BindWorldCleanup 注册无参回调;
 * Subsystem 在 World Cleanup 或 JsEnv 销毁前触发对应 Invoke*.
 */
UCLASS()
class PUERTSSCRIPTHOST_API UPuertsScriptLifecycle : public UObject
{
    GENERATED_BODY()

public:
    /** 由 TS 绑定 shutdown 回调; 可重复调用, 以后一次为准. */
    UFUNCTION(BlueprintCallable, Category = "Puerts Script Host")
    void BindShutdown(const FJsObject& Callback);

    /** 由 TS 绑定 World Cleanup 回调; 关卡切换时清空 Mixin 运行时状态. */
    UFUNCTION(BlueprintCallable, Category = "Puerts Script Host")
    void BindWorldCleanup(const FJsObject& Callback);

    /** 由宿主 Subsystem 在 JsEnv 销毁前调用. */
    void InvokeShutdown();

    /** 由宿主 Subsystem 在关联 World Cleanup 时调用. */
    void InvokeWorldCleanup();

    /** 是否已绑定 shutdown 回调 (由 BindShutdown 设置). */
    bool HasShutdownCallback() const { return bShutdownBound; }

    bool HasWorldCleanupCallback() const { return bWorldCleanupBound; }

private:
    FJsObject ShutdownCallback;
    FJsObject WorldCleanupCallback;
    bool bShutdownBound = false;
    bool bWorldCleanupBound = false;
};
