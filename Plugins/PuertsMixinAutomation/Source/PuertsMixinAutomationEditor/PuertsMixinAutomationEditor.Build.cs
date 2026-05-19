using UnrealBuildTool;

// Puerts Mixin 自动化编辑器模块：依赖 Puerts 声明生成与资产注册表
public class PuertsMixinAutomationEditor : ModuleRules
{
    public PuertsMixinAutomationEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        // 公开依赖：接入 Puerts 声明生成与 CodeGenerator 扩展
        PublicDependencyModuleNames.AddRange(
            new string[]
            {
                "Core",
                "CoreUObject",
                "Engine",
                "DeclarationGenerator",
                "JsEnv",
                "Puerts",
            }
        );

        // 私有依赖：资产监听、项目设置、编辑器环境
        PrivateDependencyModuleNames.AddRange(
            new string[]
            {
                "AssetRegistry",
                "Projects",
                "Settings",
                "UMG",
                "UnrealEd",
            }
        );
    }
}
