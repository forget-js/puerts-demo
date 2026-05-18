#include "PuertsMixinAutomationSettings.h"

UPuertsMixinAutomationSettings::UPuertsMixinAutomationSettings()
    : BlueprintRootPath(TEXT("/Game/Blueprints"))
    , MixinSourceRoot(TEXT("TypeScript/Mixins/Blueprints"))
    , MixinIndexPath(TEXT("TypeScript/Mixins/_generated/mixin-imports.ts"))
    , MixinRegisterPath(TEXT("TypeScript/Mixins/register.ts"))
    , bCreateOnlyMissingMixins(true)
    , bGenerateOnBlueprintSave(true)
    , BlueprintSaveDebounceSeconds(1.0f)
{
}
