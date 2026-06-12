/**
 * 按 Mixin 实例隔离的运行时资源 (委托、定时器、HTTP 请求).
 *
 * 每个 Actor / Widget 等 owner 对应一份 {@link MixinRuntimeState}, 在 ReceiveBeginPlay
 * 中通过 getMixinRuntimeState(this) 获取, 在 ReceiveEndPlay 中必须 clearMixinRuntimeState(this).
 */

import { DelegateBag } from './DelegateBag';
import { HttpRequestBag } from './Http/HttpRequestBag';
import { TimerBag } from './TimerBag';

/** 单个 Mixin 实例持有的可清理运行时资源 (含 HttpRequestBag). */
export interface MixinRuntimeState {
    readonly delegates: DelegateBag;
    readonly timers: TimerBag;
    readonly requests: HttpRequestBag;
}

type UnrealObjectLike = object & {
    GetUniqueID?: () => number;
};

// Puerts 可能为同一个 UObject 生成不同 JS wrapper, 因此 UObject 状态使用 GetUniqueID 作 key.
const mixinStatesByUniqueId = new Map<number, MixinRuntimeState>();

// 普通 JS 对象仍使用 WeakMap, 避免全局 Map 长期持有已销毁对象.
const mixinStates = new WeakMap<object, MixinRuntimeState>();

function getStableObjectId(owner: object): number | undefined {
    const uniqueId = (owner as UnrealObjectLike).GetUniqueID?.();
    if (typeof uniqueId === 'number' && uniqueId > 0) {
        return uniqueId;
    }

    return undefined;
}

function createMixinRuntimeState(): MixinRuntimeState {
    return {
        delegates: new DelegateBag(),
        timers: new TimerBag(),
        requests: new HttpRequestBag(),
    };
}

function disposeMixinRuntimeState(state: MixinRuntimeState): void {
    state.delegates.clear();
    state.timers.clearAll();
    state.requests.cancelAll();
}

/**
 * 获取或懒创建 owner 的运行时状态.
 * @param owner Mixin 实例, 一般传 this.
 */
export function getMixinRuntimeState(owner: object): MixinRuntimeState {
    const uniqueId = getStableObjectId(owner);
    if (uniqueId !== undefined) {
        let state = mixinStatesByUniqueId.get(uniqueId);
        if (state) {
            return state;
        }

        state = createMixinRuntimeState();
        mixinStatesByUniqueId.set(uniqueId, state);
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
 * 解绑委托、取消定时器与 HTTP 请求并移除状态; 须在 ReceiveEndPlay 中调用.
 * @param owner 与 getMixinRuntimeState 传入的同一实例.
 */
export function clearMixinRuntimeState(owner: object): void {
    const uniqueId = getStableObjectId(owner);
    const state = uniqueId !== undefined ? mixinStatesByUniqueId.get(uniqueId) : mixinStates.get(owner);
    if (!state) {
        return;
    }

    disposeMixinRuntimeState(state);

    if (uniqueId !== undefined) {
        mixinStatesByUniqueId.delete(uniqueId);
        return;
    }

    mixinStates.delete(owner);
}

/** 清空全部 UObject 级 Mixin 状态 (World Cleanup / 脚本 Shutdown 兜底). */
export function clearAllMixinRuntimeStates(): void {
    for (const state of mixinStatesByUniqueId.values()) {
        disposeMixinRuntimeState(state);
    }
    mixinStatesByUniqueId.clear();
}

/** 当前 UObject 级 Mixin 状态条目数, 供 Diagnostics 与泄漏排查. */
export function getMixinRuntimeStateCount(): number {
    return mixinStatesByUniqueId.size;
}
