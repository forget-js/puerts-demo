/**
 * PuertsScriptHost 注入的 ScriptLifecycle 绑定封装.
 *
 * 避免 Bootstrap 散落 argv 类型判断与 UE 类型引用.
 */

import { argv } from 'puerts';
import * as UE from 'ue';

import { GF } from '../Global';

const LOGGER = GF.CreateLogger('ScriptLifecycle');

export interface ScriptLifecycleBindings {
    onShutdown?: () => void;
    onWorldCleanup?: () => void;
}

/** 将 shutdown / world cleanup 回调注册到 PuertsScriptHost 注入的 ScriptLifecycle. */
export function bindScriptLifecycle(bindings: ScriptLifecycleBindings): void {
    if (!bindings.onShutdown && !bindings.onWorldCleanup) {
        return;
    }

    const lifecycle = argv.getByName('ScriptLifecycle');
    if (!(lifecycle instanceof UE.PuertsScriptLifecycle)) {
        LOGGER.Warn('ScriptLifecycle argv missing; lifecycle callbacks will not run.', { toScreen: false });
        return;
    }

    if (bindings.onShutdown) {
        lifecycle.BindShutdown(bindings.onShutdown as object);
    }

    if (bindings.onWorldCleanup) {
        lifecycle.BindWorldCleanup(bindings.onWorldCleanup as object);
    }
}
