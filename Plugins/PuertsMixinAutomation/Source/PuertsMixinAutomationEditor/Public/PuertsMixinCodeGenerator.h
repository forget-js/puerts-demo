#pragma once

#include "CodeGenerator.h"
#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "PuertsMixinCodeGenerator.generated.h"

/**
 * 接入 Puerts DeclarationGenerator 的 CodeGenerator 扩展。
 * 在生成 TypeScript 声明后，同步触发 mixin 文件与 index 的生成。
 */
UCLASS()
class PUERTSMIXINAUTOMATIONEDITOR_API UPuertsMixinCodeGenerator : public UObject, public ICodeGenerator
{
    GENERATED_BODY()

public:
    void Gen_Implementation() const override;
};
