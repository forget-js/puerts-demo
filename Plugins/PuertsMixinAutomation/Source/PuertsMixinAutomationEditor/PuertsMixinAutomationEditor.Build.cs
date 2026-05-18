using UnrealBuildTool;

public class PuertsMixinAutomationEditor : ModuleRules
{
    public PuertsMixinAutomationEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

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
