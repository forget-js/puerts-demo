/**
 * 启动完成后的运行时诊断快照.
 *
 * 汇总环境、脚本版本与已注册业务模块名, 供 Bootstrap 启动日志与排查使用.
 */

import { Config } from '../Config/Config';
import { ScriptBuildInfo } from './BuildInfo';

/** 一次启动时可记录的诊断字段集合. */
export interface RuntimeDiagnostics {
    environment: string;
    scriptVersion: string;
    builtAt: string;
    commit: string;
    modules: string[];
}

/**
 * 根据当前配置与构建信息生成诊断对象.
 * @param modules 已注册 GameModule 名称列表, 通常来自 ModuleRegistry.getRegisteredModuleNames.
 */
export function createRuntimeDiagnostics(modules: string[] = []): RuntimeDiagnostics {
    return {
        environment: Config.app.environment,
        scriptVersion: ScriptBuildInfo.version,
        builtAt: ScriptBuildInfo.builtAt,
        commit: ScriptBuildInfo.commit,
        modules,
    };
}
