/**
 * 游戏脚本启动编排.
 *
 * 由 Main.ts 唯一调用; 负责安装全局错误处理、加载 Mixin 注册、驱动业务模块生命周期.
 * 本层只做启动顺序编排, 禁止写入具体玩法逻辑 (见 CodeFormat 3 / 10 节).
 */

import { Config } from '../Config/Config';
import { GF } from '../Global';
import {
    clearAllMixinRuntimeStates,
    createRuntimeDiagnostics,
    getMixinRuntimeStateCount,
    installGlobalErrorHandlers,
    ModuleRegistry,
    runSafely,
    ScriptBuildInfo,
} from '../Runtime';
import { resolveScriptNetRole } from '../Game/Core/NetRole';
import { bindScriptLifecycle } from '../Runtime/ScriptLifecycle';
import { registerGameModules } from '../Game/register';

declare const require: (moduleName: string) => unknown;

const MODULE_NAME = 'Bootstrap';
const LOGGER = GF.CreateLogger(MODULE_NAME);

/**
 * 启动游戏 TypeScript 运行时.
 *
 * 顺序: 全局错误边界 -> Mixin 副作用注册 -> Game 模块 init/start.
 * @param onShutdownReady 启动完成后绑定到 ScriptLifecycle 的 shutdown 回调 (由 Main.ts 传入).
 * @returns 已启动的 ModuleRegistry, 供后续 stop/dispose 或持有引用.
 */
export function startGame(onShutdownReady?: () => void): ModuleRegistry {
    // 尽早安装, 覆盖 Mixin require 与模块 init 中可能抛出的未捕获异常.
    installGlobalErrorHandlers();
    LOGGER.Verbose(
        'Global onerror/onunhandledrejection installed; prefer runSafelyAsync for async work and HttpTask.catch in Puerts.',
        { toScreen: false }
    );

    return runSafely(MODULE_NAME, () => {
        LOGGER.Log(`Starting game scripts (${Config.app.environment}, ${ScriptBuildInfo.version})`, {
            toScreen: false,
        });

        // 独立 scope: Mixin 注册失败不阻断后续业务模块启动日志定位.
        runSafely(`${MODULE_NAME}.Mixins`, () => {
            require('../Mixins/register');
        });

        const registry = new ModuleRegistry();
        const role = resolveScriptNetRole();
        registerGameModules(registry, role);
        registry.initAll();
        registry.startAll();

        const diagnostics = createRuntimeDiagnostics(registry.getRegisteredModuleNames());
        LOGGER.Log(`Game scripts started. Modules: ${diagnostics.modules.join(', ') || 'none'}`, {
            context: { mixinStateCount: diagnostics.mixinStateCount },
            toScreen: false,
        });

        bindScriptLifecycle({
            onShutdown: onShutdownReady,
            onWorldCleanup: () => {
                const count = getMixinRuntimeStateCount();
                clearAllMixinRuntimeStates();
                LOGGER.Verbose(`World cleanup cleared ${count} mixin runtime state(s).`, { toScreen: false });
            },
        });

        return registry;
    }) as ModuleRegistry;
}
