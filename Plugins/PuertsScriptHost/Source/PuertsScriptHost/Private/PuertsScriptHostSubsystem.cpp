#include "PuertsScriptHostSubsystem.h"

#include "PuertsScriptHostDebuggerPort.h"
#include "PuertsScriptHostSettings.h"
#include "PuertsScriptLifecycle.h"
#include "PuertsSetting.h"

#include "Engine/GameInstance.h"
#include "PuertsNamespaceDef.h"
#include "JsEnv.h"
#include "JSLogger.h"
#include "JSModuleLoader.h"

DEFINE_LOG_CATEGORY_STATIC(LogPuertsScriptHost, Log, All);

void UPuertsScriptHostSubsystem::StartScripts()
{
    if (bRunning)
    {
        UE_LOG(LogPuertsScriptHost, Warning, TEXT("StartScripts called while scripts are already running."));
        return;
    }

    const UPuertsScriptHostSettings* HostSettings = GetDefault<UPuertsScriptHostSettings>();
    if (!HostSettings)
    {
        UE_LOG(LogPuertsScriptHost, Error, TEXT("PuertsScriptHostSettings is unavailable."));
        return;
    }

    CreateJsEnv();
    if (!JsEnv.IsValid())
    {
        return;
    }

    Lifecycle = NewObject<UPuertsScriptLifecycle>(this);

    TArray<TPair<FString, UObject*>> Arguments;
    if (HostSettings->bPassGameInstanceToScript && GetGameInstance())
    {
        Arguments.Add(TPair<FString, UObject*>(TEXT("GameInstance"), GetGameInstance()));
    }
    if (HostSettings->bPassScriptLifecycleToScript && Lifecycle)
    {
        Arguments.Add(TPair<FString, UObject*>(TEXT("ScriptLifecycle"), Lifecycle));
    }

    const FString EntryModule = HostSettings->EntryModule.IsEmpty() ? TEXT("Main") : HostSettings->EntryModule;
    JsEnv->Start(EntryModule, Arguments);
    bRunning = true;

    UE_LOG(LogPuertsScriptHost, Log, TEXT("Puerts scripts started (entry=%s)."), *EntryModule);
}

void UPuertsScriptHostSubsystem::StopScripts()
{
    if (!bRunning && !JsEnv.IsValid())
    {
        return;
    }

    if (Lifecycle && Lifecycle->HasShutdownCallback())
    {
        Lifecycle->InvokeShutdown();
    }

    JsEnv.Reset();
    Lifecycle = nullptr;
    bRunning = false;

    UE_LOG(LogPuertsScriptHost, Log, TEXT("Puerts scripts stopped."));
}

void UPuertsScriptHostSubsystem::Deinitialize()
{
    StopScripts();
    Super::Deinitialize();
}

PUERTS_NAMESPACE::FJsEnv* UPuertsScriptHostSubsystem::GetJsEnv() const
{
    return JsEnv.Get();
}

void UPuertsScriptHostSubsystem::CreateJsEnv()
{
    const UPuertsSetting& PuertsSettings = *GetDefault<UPuertsSetting>();
    const FString ScriptRoot = ResolveScriptRootPath();

    const auto ModuleLoader = std::make_shared<PUERTS_NAMESPACE::DefaultJSModuleLoader>(ScriptRoot);
    const auto Logger = std::make_shared<PUERTS_NAMESPACE::FDefaultLogger>();

    const int32 DebugPort = ResolveDebugPort();
    if (DebugPort < 0)
    {
        // InDebugPort = -1: 不启动 V8 Inspector WebSocket (对齐 Puerts DebugEnable=false).
        JsEnv = MakeShared<PUERTS_NAMESPACE::FJsEnv>(ModuleLoader, Logger, -1);
    }
    else
    {
        JsEnv = MakeShared<PUERTS_NAMESPACE::FJsEnv>(ModuleLoader, Logger, DebugPort);
        UE_LOG(LogPuertsScriptHost, Log, TEXT("Puerts V8 Inspector enabled on port %d."), DebugPort);
    }

    if (PuertsSettings.WaitDebugger && DebugPort >= 0)
    {
        JsEnv->WaitDebugger(PuertsSettings.WaitDebuggerTimeout);
    }
}

FString UPuertsScriptHostSubsystem::ResolveScriptRootPath() const
{
    const UPuertsScriptHostSettings* HostSettings = GetDefault<UPuertsScriptHostSettings>();
    if (HostSettings && !HostSettings->ScriptRootPath.IsEmpty())
    {
        return HostSettings->ScriptRootPath;
    }

    return GetDefault<UPuertsSetting>()->RootPath;
}

int32 UPuertsScriptHostSubsystem::ResolveDebugPort() const
{
#if UE_BUILD_SHIPPING
    // Shipping 包永远不暴露调试端口, 忽略 ini 中的 DebugEnable.
    return -1;
#else
    const UPuertsSetting& PuertsSettings = *GetDefault<UPuertsSetting>();
    if (!PuertsSettings.DebugEnable)
    {
        return -1;
    }

    return FPuertsScriptHostDebuggerPort::Resolve(PuertsSettings.DebugPort);
#endif
}
