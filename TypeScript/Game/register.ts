/**
 * 业务模块显式注册.
 *
 * 各 Feature 模块在此 registry.register(...), 由 Bootstrap/startGame 统一 init/start.
 * 禁止在 Mixin 中隐式注册业务模块.
 */

import { shouldRunFeatureModule, type ScriptNetRole } from '../Game/Core/NetRole';
import { DevHttpModule } from './Features/DevHttp';
import { MovementControlModule } from './Features/MovementControl';
import type { GameModule, ModuleRegistry } from '../Runtime';
import { ApiModule } from './Services';

const FEATURE_MODULES: GameModule[] = [ApiModule, MovementControlModule, DevHttpModule];

/**
 * 向启动注册表登记 Game/Features 下的业务模块.
 * @param registry Bootstrap 创建的 ModuleRegistry 实例.
 * @param role 当前脚本 NetRole, 用于过滤 Client/Server 专属模块.
 */
export function registerGameModules(registry: ModuleRegistry, role?: ScriptNetRole): void {
    for (const module of FEATURE_MODULES) {
        if (!shouldRunFeatureModule(module.executionContext, role)) {
            continue;
        }

        registry.register(module);
    }
}
