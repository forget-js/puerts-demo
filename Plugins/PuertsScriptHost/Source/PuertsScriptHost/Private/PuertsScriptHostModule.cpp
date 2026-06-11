#include "PuertsScriptHostModule.h"

#include "Modules/ModuleManager.h"

#if WITH_EDITOR
#include "ISettingsModule.h"
#include "PuertsScriptHostSettings.h"
#endif

#define LOCTEXT_NAMESPACE "FPuertsScriptHostModule"

IMPLEMENT_MODULE(FPuertsScriptHostModule, PuertsScriptHost)

void FPuertsScriptHostModule::StartupModule()
{
#if WITH_EDITOR
    if (ISettingsModule* SettingsModule = FModuleManager::GetModulePtr<ISettingsModule>("Settings"))
    {
        SettingsModule->RegisterSettings(
            "Project",
            "Plugins",
            "PuertsScriptHost",
            LOCTEXT("SettingsName", "Puerts Script Host"),
            LOCTEXT("SettingsDescription", "Configure Puerts script entry module and startup argv."),
            GetMutableDefault<UPuertsScriptHostSettings>());
    }
#endif
}

void FPuertsScriptHostModule::ShutdownModule()
{
#if WITH_EDITOR
    if (ISettingsModule* SettingsModule = FModuleManager::GetModulePtr<ISettingsModule>("Settings"))
    {
        SettingsModule->UnregisterSettings("Project", "Plugins", "PuertsScriptHost");
    }
#endif
}

#undef LOCTEXT_NAMESPACE
