#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "PuertsMixinAutomationSettings.generated.h"

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

    /** Mixin TypeScript 源文件的输出根目录（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinSourceRoot;

    /** 自动生成的 mixin 聚合 import 文件路径（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinIndexPath;

    /** Mixin 注册入口文件路径，首次生成时创建（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinRegisterPath;

    /** 为 true 时仅创建尚不存在的 mixin 文件，不覆盖已有文件 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bCreateOnlyMissingMixins;

    /** 为 true 时在 Blueprint 保存后自动生成/更新 mixin 与声明 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bGenerateOnBlueprintSave;

    /** Blueprint 保存后的防抖延迟（秒），避免连续保存触发多次生成 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation", meta = (ClampMin = "0.1", UIMin = "0.1"))
    float BlueprintSaveDebounceSeconds;

    /** Node.js 可执行文件路径，用于运行 mixin 模板生成脚本 */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    FString NodeExecutablePath;

    /** mixin 模板生成脚本路径（相对于项目根目录） */
    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    FString MixinTemplateScriptPath;
};
