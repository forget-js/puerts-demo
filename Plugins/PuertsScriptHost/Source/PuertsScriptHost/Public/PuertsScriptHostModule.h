#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/** PuertsScriptHost 运行时模块入口. */
class FPuertsScriptHostModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
};
