/**
 * 业务模块显式注册.
 *
 * 各 Feature 模块在此 registry.register(...), 由 Bootstrap/startGame 统一 init/start.
 * 禁止在 Mixin 中隐式注册业务模块.
 */

import type { ModuleRegistry } from '../Runtime';

/**
 * 向启动注册表登记 Game/Features 下的业务模块.
 * @param registry Bootstrap 创建的 ModuleRegistry 实例.
 */
export function registerGameModules(registry: ModuleRegistry): void {
    // 在此 registry.register({ name: '...', init() {}, start() {} });
    void registry;
}
