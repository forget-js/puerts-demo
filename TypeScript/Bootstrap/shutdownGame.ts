/**
 * 游戏脚本关闭编排.
 *
 * 由 PuertsScriptHost 插件在 Subsystem::Deinitialize 时通过 ScriptLifecycle 回调触发.
 * 顺序与 startGame 对称: clear mixin states -> stop -> dispose (逆序).
 */

import { GF } from '../Global';
import { clearAllMixinRuntimeStates, getMixinRuntimeStateCount, ModuleRegistry, runSafely } from '../Runtime';

const LOGGER = GF.CreateLogger('Bootstrap');

/**
 * 停止并销毁已注册的业务模块.
 * @param registry startGame 返回的 ModuleRegistry.
 */
export function shutdownGame(registry: ModuleRegistry): void {
    runSafely('Bootstrap.shutdown', () => {
        const mixinStateCount = getMixinRuntimeStateCount();
        clearAllMixinRuntimeStates();
        LOGGER.Log('Shutting down game scripts', {
            context: { clearedMixinStates: mixinStateCount },
            toScreen: false,
        });
        registry.stopAll();
        registry.disposeAll();
    });
}
