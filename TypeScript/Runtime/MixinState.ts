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

type UnrealObjectLike = object & {
    GetPathName?: () => string;
    GetName?: () => string;
};

// Puerts 可能为同一个 UObject 生成不同 JS wrapper, 因此 UObject 状态必须使用稳定字符串 key。
const mixinStatesByObjectKey = new Map<string, MixinRuntimeState>();

// 普通 JS 对象仍使用 WeakMap, 避免全局 Map 长期持有已销毁对象.
const mixinStates = new WeakMap<object, MixinRuntimeState>();

function getStableObjectKey(owner: object): string | undefined {
    const unrealObject = owner as UnrealObjectLike;
    const pathName = unrealObject.GetPathName?.();
    if (pathName) {
        return pathName;
    }

    const name = unrealObject.GetName?.();
    return name ? `name:${name}` : undefined;
}

function createMixinRuntimeState(): MixinRuntimeState {
    return {
        delegates: new DelegateBag(),
        timers: new TimerBag(),
    };
}

/**
 * 获取或懒创建 owner 的运行时状态.
 * @param owner Mixin 实例, 一般传 this.
 */
export function getMixinRuntimeState(owner: object): MixinRuntimeState {
    const objectKey = getStableObjectKey(owner);
    if (objectKey) {
        let state = mixinStatesByObjectKey.get(objectKey);
        if (state) {
            return state;
        }

        state = createMixinRuntimeState();
        mixinStatesByObjectKey.set(objectKey, state);
        return state;
    }

    let state = mixinStates.get(owner);
    if (state) {
        return state;
    }

    state = createMixinRuntimeState();
    mixinStates.set(owner, state);
    return state;
}

/**
 * 解绑委托、取消定时器并移除状态; 须在 ReceiveEndPlay 中调用.
 * @param owner 与 getMixinRuntimeState 传入的同一实例.
 */
export function clearMixinRuntimeState(owner: object): void {
    const objectKey = getStableObjectKey(owner);
    const state = objectKey ? mixinStatesByObjectKey.get(objectKey) : mixinStates.get(owner);
    if (!state) {
        return;
    }

    state.delegates.clear();
    state.timers.clearAll();

    if (objectKey) {
        mixinStatesByObjectKey.delete(objectKey);
        return;
    }

    mixinStates.delete(owner);
}
