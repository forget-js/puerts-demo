#pragma once

#include "Modules/ModuleManager.h"

/** PuertsHttpTransport 插件模块; 当前无额外 Startup 逻辑, 类型由 UHT 反射注册. */
class FPuertsHttpTransportModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
};
