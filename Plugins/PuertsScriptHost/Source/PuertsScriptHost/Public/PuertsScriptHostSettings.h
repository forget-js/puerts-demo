#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "PuertsScriptHostSettings.generated.h"

/**
 * PuertsScriptHost 插件级配置.
 * 编辑器路径: Project Settings -> Plugins -> Puerts Script Host
 */
UCLASS(Config = PuertsScriptHost, DefaultConfig, meta = (DisplayName = "Puerts Script Host"))
class PUERTSSCRIPTHOST_API UPuertsScriptHostSettings : public UObject
{
    GENERATED_BODY()

public:
    /** FJsEnv::Start 加载的入口模块名 (相对 Content/JavaScript, 无扩展名). */
    UPROPERTY(Config, EditAnywhere, Category = "Script", meta = (DisplayName = "Entry Module"))
    FString EntryModule = TEXT("Main");

    /** 是否向 TS 注入 argv: GameInstance. */
    UPROPERTY(Config, EditAnywhere, Category = "Script", meta = (DisplayName = "Pass GameInstance To Script"))
    bool bPassGameInstanceToScript = true;

    /** 是否向 TS 注入 argv: ScriptLifecycle (shutdown 绑定必需). */
    UPROPERTY(Config, EditAnywhere, Category = "Script", meta = (DisplayName = "Pass ScriptLifecycle To Script"))
    bool bPassScriptLifecycleToScript = true;

    /**
     * JS 源码根目录 (相对项目根, 如 JavaScript).
     * 留空时回退 UPuertsSetting::RootPath.
     */
    UPROPERTY(Config, EditAnywhere, Category = "Script", meta = (DisplayName = "Script Root Path"))
    FString ScriptRootPath;
};
