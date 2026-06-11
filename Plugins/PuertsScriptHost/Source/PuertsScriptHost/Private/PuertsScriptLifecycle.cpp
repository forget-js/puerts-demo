#include "PuertsScriptLifecycle.h"

void UPuertsScriptLifecycle::BindShutdown(const FJsObject& Callback)
{
    ShutdownCallback = Callback;
    bShutdownBound = true;
}

void UPuertsScriptLifecycle::InvokeShutdown()
{
    if (!bShutdownBound)
    {
        return;
    }

    // Action() 内部会校验 JsEnv 存活与函数类型, 并捕获 JS 异常写日志.
    ShutdownCallback.Action();
    ShutdownCallback = FJsObject();
    bShutdownBound = false;
}
