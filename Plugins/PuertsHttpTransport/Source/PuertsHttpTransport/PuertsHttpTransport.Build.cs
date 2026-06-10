using UnrealBuildTool;

/** PuertsHttpTransport 构建规则: 依赖 UE HTTP 与 Json 模块. */
public class PuertsHttpTransport : ModuleRules
{
    public PuertsHttpTransport(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(
            new string[]
            {
                "Core",
                "CoreUObject",
                "Engine",
            }
        );

        PrivateDependencyModuleNames.AddRange(
            new string[]
            {
                "HTTP",
                "Json",
            }
        );
    }
}
