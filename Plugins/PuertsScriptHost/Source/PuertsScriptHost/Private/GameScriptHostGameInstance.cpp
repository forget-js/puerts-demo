#include "GameScriptHostGameInstance.h"

#include "PuertsScriptHostSubsystem.h"

void UGameScriptHostGameInstance::OnStart()
{
    Super::OnStart();

    if (UPuertsScriptHostSubsystem* ScriptHost = GetSubsystem<UPuertsScriptHostSubsystem>())
    {
        ScriptHost->StartScripts();
    }
}
