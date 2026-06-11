#pragma once

#include "CoreMinimal.h"

/**
 * V8 Inspector 调试端口解析.
 * 逻辑对齐 Puerts 官方 PuertsModule::GetDebuggerPortFromCommandLine.
 */
namespace FPuertsScriptHostDebuggerPort
{
    /**
     * 解析最终监听端口.
     * @param DefaultPort  UPuertsSetting::DebugPort (如 8080).
     * @return 正数表示启用 Inspector; -1 表示禁用 (使用 FJsEnv 无端口构造).
     */
    int32 Resolve(int32 DefaultPort);
}
