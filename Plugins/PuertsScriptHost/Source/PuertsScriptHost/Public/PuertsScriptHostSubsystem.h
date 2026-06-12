#pragma once

#include "CoreMinimal.h"
#include "PuertsNamespaceDef.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "PuertsScriptHostSubsystem.generated.h"

// 必须先包含 PuertsNamespaceDef.h, 否则 PUERTS_NAMESPACE 不会展开为 puerts, 导致与 JsEnv.h 类型不一致.
namespace PUERTS_NAMESPACE
{
class FJsEnv;
}

class UPuertsScriptLifecycle;
class UWorld;

/**
 * Puerts 脚本宿主 Subsystem: 唯一 FJsEnv 持有者.
 *
 * 负责按配置创建 JsEnv、启动入口模块、在 Deinitialize 时触发 TS shutdown 并释放 JsEnv.
 * 其他 C++ 可通过 GetSubsystem<UPuertsScriptHostSubsystem>() 访问.
 */
UCLASS()
class PUERTSSCRIPTHOST_API UPuertsScriptHostSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    /** 创建 JsEnv 并执行入口模块 (由 GameInstance::OnStart 或插件 GameInstance 调用). */
    void StartScripts();

    /** 显式停止脚本 (幂等); Deinitialize 时也会调用. */
    void StopScripts();

    bool IsScriptRunning() const { return bRunning; }

    /** 供扩展模块访问 JsEnv; 未启动时返回 nullptr. */
    PUERTS_NAMESPACE::FJsEnv* GetJsEnv() const;

    virtual void Deinitialize() override;

private:
    void CreateJsEnv();
    FString ResolveScriptRootPath() const;
    int32 ResolveDebugPort() const;
    void RegisterWorldCleanupDelegate();
    void UnregisterWorldCleanupDelegate();
    void HandleWorldCleanup(UWorld* World, bool bSessionEnded, bool bCleanupResources);

    TSharedPtr<PUERTS_NAMESPACE::FJsEnv> JsEnv;
    TObjectPtr<UPuertsScriptLifecycle> Lifecycle;
    FDelegateHandle WorldCleanupDelegateHandle;
    bool bRunning = false;
};
