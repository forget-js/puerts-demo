/**
 * Puerts 脚本常驻入口.
 *
 * 由 PuertsScriptHost 插件加载; 负责启动与 shutdown 回调注册, 不写业务逻辑.
 */
import { startGame } from './Bootstrap/startGame';
import { shutdownGame } from './Bootstrap/shutdownGame';
import type { ModuleRegistry } from './Runtime';

/** 模块级持有 registry, 供 ScriptLifecycle 关闭时 stop/dispose. */
let gameRegistry: ModuleRegistry | undefined;

function shutdown(): void {
    if (!gameRegistry) {
        return;
    }

    shutdownGame(gameRegistry);
    gameRegistry = undefined;
}

gameRegistry = startGame(shutdown);
