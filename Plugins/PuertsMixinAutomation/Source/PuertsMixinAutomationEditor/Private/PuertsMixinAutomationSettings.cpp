#include "PuertsMixinAutomationSettings.h"

UPuertsMixinAutomationSettings::UPuertsMixinAutomationSettings()
    : BlueprintRootPath(TEXT("/Game/Blueprints"))
    , ScriptedBlueprintRootPath(TEXT("/Game/Blueprints/Scripted"))
    , MixinSourceRoot(TEXT("TypeScript/Mixins/Blueprints"))
    , MixinIndexPath(TEXT("TypeScript/Mixins/_generated/mixin-imports.ts"))
    , MixinRegisterPath(TEXT("TypeScript/Mixins/register.ts"))
    , BlueprintManifestPath(TEXT("TypeScript/Mixins/_generated/blueprint-manifest.json"))
    , BlueprintCatalogPath(TEXT("TypeScript/Blueprints/_generated/BlueprintCatalog.ts"))
    , AutoCreateMixinPolicy(EPuertsMixinAutoCreatePolicy::Disabled)
    , bCreateOnlyMissingMixins(true)
    , bGenerateOnBlueprintSave(true)
    , bAutoSyncBlueprintRename(true)
    , bAutoRenameMixinFile(true)
    , BlueprintSaveDebounceSeconds(1.0f)
    , NodeExecutablePath(TEXT("node"))
    , MixinTemplateScriptPath(TEXT("Plugins/PuertsMixinAutomation/Scripts/generate-mixin-template.mjs"))
    , BlueprintCatalogScriptPath(TEXT("Plugins/PuertsMixinAutomation/Scripts/generate-blueprint-catalog.mjs"))
{
}
