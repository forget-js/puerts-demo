#include "PuertsMixinCodeGenerator.h"

#include "PuertsMixinAutomationEditorModule.h"

void UPuertsMixinCodeGenerator::Gen_Implementation() const
{
    if (FPuertsMixinAutomationEditorModule::IsAvailable())
    {
        FPuertsMixinAutomationEditorModule::Get().GenerateMissingMixinsAndIndex();
    }
}
