/**
 * 游戏脚本启动编排.
 *
 * 由 Main.ts 唯一调用; 负责安装全局错误处理、加载 Mixin 注册、驱动业务模块生命周期.
 * 本层只做启动顺序编排, 禁止写入具体玩法逻辑 (见 CodeFormat 3 / 10 节).
 */

import { Config } from '../Config/Config';
import { GF } from '../Global';
import {
    createRuntimeDiagnostics,
    installGlobalErrorHandlers,
    ModuleRegistry,
    runSafely,
    ScriptBuildInfo,
} from '../Runtime';
import { registerGameModules } from '../Game/register';

declare const require: (moduleName: string) => unknown;

const MODULE_NAME = 'Bootstrap';
const LOGGER = GF.CreateLogger(MODULE_NAME);

/**
 * 启动游戏 TypeScript 运行时.
 *
 * 顺序: 全局错误边界 -> Mixin 副作用注册 -> Game 模块 init/start.
 * @returns 已启动的 ModuleRegistry, 供后续 stop/dispose 或持有引用.
 */
export function startGame(): ModuleRegistry {
    // 尽早安装, 覆盖 Mixin require 与模块 init 中可能抛出的未捕获异常.
    installGlobalErrorHandlers();

    return runSafely(MODULE_NAME, () => {
        LOGGER.Log(`Starting game scripts (${Config.app.environment}, ${ScriptBuildInfo.version})`, {
            toScreen: false,
        });

        // 独立 scope: Mixin 注册失败不阻断后续业务模块启动日志定位.
        runSafely(`${MODULE_NAME}.Mixins`, () => {
            require('../Mixins/register');
        });

        const registry = new ModuleRegistry();
        registerGameModules(registry);
        registry.initAll();
        registry.startAll();

        const diagnostics = createRuntimeDiagnostics(registry.getRegisteredModuleNames());
        LOGGER.Log(`Game scripts started. Modules: ${diagnostics.modules.join(', ') || 'none'}`, {
            toScreen: false,
        });

        return registry;
    }) as ModuleRegistry;
}
