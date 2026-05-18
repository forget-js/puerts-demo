#pragma once

#include "CodeGenerator.h"
#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "PuertsMixinCodeGenerator.generated.h"

UCLASS()
class PUERTSMIXINAUTOMATIONEDITOR_API UPuertsMixinCodeGenerator : public UObject, public ICodeGenerator
{
    GENERATED_BODY()

public:
    void Gen_Implementation() const override;
};
