#include "PuertsHttpTransportModule.h"

#include "Modules/ModuleManager.h"

IMPLEMENT_MODULE(FPuertsHttpTransportModule, PuertsHttpTransport)

void FPuertsHttpTransportModule::StartupModule()
{
    // UPuertsHttpClient 由 UCLASS 反射自动注册, 此处无需手动初始化.
}

void FPuertsHttpTransportModule::ShutdownModule()
{
}
