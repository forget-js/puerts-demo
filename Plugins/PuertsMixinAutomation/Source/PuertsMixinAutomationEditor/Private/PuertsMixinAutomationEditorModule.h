#pragma once

#include "Containers/Ticker.h"
#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

struct FAssetData;

class FPuertsMixinAutomationEditorModule : public IModuleInterface
{
public:
    static FPuertsMixinAutomationEditorModule& Get();
    static bool IsAvailable();

    void StartupModule() override;
    void ShutdownModule() override;

    void GenerateMissingMixinsAndIndex();

private:
    void RegisterSettings();
    void UnregisterSettings();
    void RegisterAssetCallbacks();
    void UnregisterAssetCallbacks();

    void OnAssetUpdated(const FAssetData& AssetData);
    bool TickPendingDeclarationRefresh(float DeltaTime);
    void QueueDeclarationRefresh(FName SearchPath);
    void FlushPendingDeclarationRefresh();

    int32 GenerateMissingMixinFiles() const;
    void GenerateMixinIndex() const;
    void EnsureMixinRegisterFile() const;

    FDelegateHandle AssetUpdatedHandle;
    FTSTicker::FDelegateHandle TickerHandle;
    TSet<FName> PendingDeclarationSearchPaths;
    double LastBlueprintUpdateTime = 0.0;
};
