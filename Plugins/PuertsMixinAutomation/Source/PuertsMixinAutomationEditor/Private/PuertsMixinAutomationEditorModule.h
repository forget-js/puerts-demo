#pragma once

#include "Containers/Ticker.h"
#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

struct FAssetData;

/**
 * Puerts Mixin 自动化编辑器模块。
 *
 * 监听 Blueprint 资产变更，在保存后刷新 TypeScript 声明、
 * 为缺失的 Blueprint 生成 mixin 模板，并维护 mixin 聚合 import 文件。
 */
class FPuertsMixinAutomationEditorModule : public IModuleInterface
{
public:
    static FPuertsMixinAutomationEditorModule& Get();
    static bool IsAvailable();

    void StartupModule() override;
    void ShutdownModule() override;

    /** 扫描缺失的 mixin 文件并生成 index / register 入口（可由 CodeGenerator 手动触发） */
    void GenerateMissingMixinsAndIndex();

private:
    void RegisterSettings();
    void UnregisterSettings();
    void RegisterAssetCallbacks();
    void UnregisterAssetCallbacks();

    /** 资产注册表回调：Blueprint 更新时入队等待刷新 */
    void OnAssetUpdated(const FAssetData& AssetData);
    /** 防抖 Ticker：延迟执行声明刷新与 mixin 生成 */
    bool TickPendingDeclarationRefresh(float DeltaTime);
    void QueueDeclarationRefresh(FName SearchPath);
    /** 批量刷新 TypeScript 声明并触发 mixin 生成流程 */
    void FlushPendingDeclarationRefresh();

    /** 遍历 BlueprintRootPath 下所有 Blueprint，为缺失项创建 mixin 文件 */
    int32 GenerateMissingMixinFiles() const;
    /** 调用 Node 脚本为单个 Blueprint 生成 mixin 模板内容 */
    bool RunMixinTemplateGenerator(const FString& BlueprintPackageName) const;
    /** 扫描 MixinSourceRoot 下所有 .ts 文件，重写 mixin-imports.ts */
    void GenerateMixinIndex() const;
    /** 若 register.ts 不存在则创建，用于统一加载所有 mixin */
    void EnsureMixinRegisterFile() const;

    FDelegateHandle AssetUpdatedHandle;
    FTSTicker::FDelegateHandle TickerHandle;
    /** 待刷新的资产包路径集合（合并多次保存） */
    TSet<FName> PendingDeclarationSearchPaths;
    /** 最近一次 Blueprint 更新时间，用于防抖 */
    double LastBlueprintUpdateTime = 0.0;
};
