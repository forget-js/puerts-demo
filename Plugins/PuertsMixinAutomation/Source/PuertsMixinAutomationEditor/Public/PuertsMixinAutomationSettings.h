#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "PuertsMixinAutomationSettings.generated.h"

UCLASS(Config = PuertsMixinAutomation, DefaultConfig)
class PUERTSMIXINAUTOMATIONEDITOR_API UPuertsMixinAutomationSettings : public UObject
{
    GENERATED_BODY()

public:
    UPuertsMixinAutomationSettings();

    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString BlueprintRootPath;

    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinSourceRoot;

    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinIndexPath;

    UPROPERTY(EditAnywhere, Config, Category = "Paths")
    FString MixinRegisterPath;

    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bCreateOnlyMissingMixins;

    UPROPERTY(EditAnywhere, Config, Category = "Generation")
    bool bGenerateOnBlueprintSave;

    UPROPERTY(EditAnywhere, Config, Category = "Generation", meta = (ClampMin = "0.1", UIMin = "0.1"))
    float BlueprintSaveDebounceSeconds;
};
