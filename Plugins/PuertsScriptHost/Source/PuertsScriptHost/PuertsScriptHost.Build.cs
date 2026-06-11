using System.IO;
using UnrealBuildTool;

/** PuertsScriptHost: 可迁移的 Puerts JsEnv 宿主插件构建规则. */
public class PuertsScriptHost : ModuleRules
{
    public PuertsScriptHost(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(
            new string[]
            {
                "Core",
                "CoreUObject",
                "Engine",
                // 公共头文件引用 PuertsNamespaceDef / FJsEnv 前向声明.
                "JsEnv",
            }
        );

        PrivateDependencyModuleNames.AddRange(
            new string[]
            {
                "Puerts",
            }
        );

        if (Target.bBuildEditor)
        {
            PrivateDependencyModuleNames.Add("UnrealEd");
        }

        // UPuertsSetting 位于 Puerts 模块 Private 目录, 宿主需读取官方调试配置.
        PrivateIncludePaths.Add(
            Path.GetFullPath(Path.Combine(ModuleDirectory, "..", "..", "..", "Puerts", "Source", "Puerts", "Private"))
        );
    }
}
