/**
 * 按 Mixin 实例隔离的运行时资源 (委托、定时器).
 *
 * 每个 Actor / Widget 等 owner 对应一份 {@link MixinRuntimeState}, 在 ReceiveBeginPlay
 * 中通过 getMixinRuntimeState(this) 获取, 在 ReceiveEndPlay 中必须 clearMixinRuntimeState(this).
 */

import { DelegateBag } from './DelegateBag';
import { TimerBag } from './TimerBag';

/** 单个 Mixin 实例持有的可清理运行时资源. */
export interface MixinRuntimeState {
    readonly delegates: DelegateBag;
    readonly timers: TimerBag;
}

// WeakMap: owner 被 GC 后条目自动释放, 避免全局 Map 长期持有已销毁 Actor.
const mixinStates = new WeakMap<object, MixinRuntimeState>();

/**
 * 获取或懒创建 owner 的运行时状态.
 * @param owner Mixin 实例, 一般传 this.
 */
export function getMixinRuntimeState(owner: object): MixinRuntimeState {
    let state = mixinStates.get(owner);
    if (state) {
        return state;
    }

    state = {
        delegates: new DelegateBag(),
        timers: new TimerBag(),
    };
    mixinStates.set(owner, state);
    return state;
}

/**
 * 解绑委托、取消定时器并移除状态; 须在 ReceiveEndPlay 中调用.
 * @param owner 与 getMixinRuntimeState 传入的同一实例.
 */
export function clearMixinRuntimeState(owner: object): void {
    const state = mixinStates.get(owner);
    if (!state) {
        return;
    }

    state.delegates.clear();
    state.timers.clearAll();
    mixinStates.delete(owner);
}
