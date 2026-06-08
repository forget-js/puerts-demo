#include "PuertsMixinAutomationSettings.h"

UPuertsMixinAutomationSettings::UPuertsMixinAutomationSettings()
    : BlueprintRootPath(TEXT("/Game/Blueprints"))
    , ScriptedBlueprintRootPath(TEXT("/Game/Blueprints/Scripted"))
    , MixinSourceRoot(TEXT("TypeScript/Mixins/Blueprints"))
    , MixinIndexPath(TEXT("TypeScript/Mixins/_generated/mixin-imports.ts"))
    , MixinRegisterPath(TEXT("TypeScript/Mixins/register.ts"))
    , AutoCreateMixinPolicy(EPuertsMixinAutoCreatePolicy::Disabled)
    , bCreateOnlyMissingMixins(true)
    , bGenerateOnBlueprintSave(true)
    , BlueprintSaveDebounceSeconds(1.0f)
    , NodeExecutablePath(TEXT("node"))
    , MixinTemplateScriptPath(TEXT("Plugins/PuertsMixinAutomation/Scripts/generate-mixin-template.mjs"))
{
}
