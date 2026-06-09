#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "PuertsMixinAutomationSettings.generated.h"

UENUM()
enum class EPuertsMixinAutoCreatePolicy : uint8
{
    Disabled UMETA(DisplayName = "Disabled"),
    ScriptedRootOnly UMETA(DisplayName = "Scripted Root Only"),
    All UMETA(DisplayName = "All Blueprints")
};

/**
 * Puerts Mixin 自动化插件的项目级配置。
 * 可在 项目设置 -> 插件 -> Puerts Mixin Automation 中编辑。
 */
UCLASS(Config = PuertsMixinAutomation, DefaultConfig)
class PUERTSMIXINAUTOMATIONEDITOR_API UPuertsMixinAutomationSettings : public UObject
{
    GENERATED_BODY()

public:
    UPuertsMixinAutomationSettings();

    /** 扫描 Blueprint 资产的根路径（Content 路径，如 /Game/Blueprints） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString BlueprintRootPath;

    /** 允许自动创建 Mixin 的脚本蓝图目录（Content 路径，如 /Game/Blueprints/Scripted） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString ScriptedBlueprintRootPath;

    /** Mixin TypeScript 源文件的输出根目录（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinSourceRoot;

    /** 自动生成的 mixin 聚合 import 文件路径（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinIndexPath;

    /** Mixin 注册入口文件路径，首次生成时创建（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinRegisterPath;

    /** Blueprint Manifest 路径，记录蓝图 GUID、当前路径与一对一 Mixin 映射（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString BlueprintManifestPath;

    /** 自动生成的 Blueprint Catalog TypeScript 路径（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString BlueprintCatalogPath;

    /** Mixin 模板自动创建策略；正式项目建议 Disabled，通过右键菜单显式创建 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    EPuertsMixinAutoCreatePolicy AutoCreateMixinPolicy;

    /** 为 true 时仅创建尚不存在的 Mixin 文件，不覆盖已有文件 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bCreateOnlyMissingMixins;

    /** 为 true 时在 Blueprint 保存后自动刷新声明与已有 Mixin 索引 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bGenerateOnBlueprintSave;

    /** 为 true 时监听 Blueprint 重命名，并自动同步 Manifest、Catalog、Mixin 文件与 TS 引用 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bAutoSyncBlueprintRename;

    /** 为 true 时 Blueprint 重命名会同步移动一对一 Mixin 文件 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bAutoRenameMixinFile;

    /** Blueprint 保存后的防抖延迟（秒），避免连续保存触发多次生成 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation", meta = (ClampMin = "0.1", UIMin = "0.1"))
    float BlueprintSaveDebounceSeconds;

    /** Node.js 可执行文件路径，用于运行 mixin 模板生成脚本 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    FString NodeExecutablePath;

    /** mixin 模板生成脚本路径（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    FString MixinTemplateScriptPath;

    /** Blueprint Catalog / Manifest 同步脚本路径（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    FString BlueprintCatalogScriptPath;
};
