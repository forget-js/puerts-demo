/**
 * UObject / Mixin owner 有效性检测.
 *
 * 用于 await 前后守卫, 避免 Actor/Widget 已 EndPlay 后继续访问 UE 对象.
 */

import * as UE from 'ue';

type UnrealObjectLike = object & {
    IsValid?: () => boolean;
};

/** 检测 owner 是否仍可安全用于 UE API 调用. */
export function isOwnerValid(owner: unknown): boolean {
    if (owner === null || owner === undefined) {
        return false;
    }

    if (typeof owner !== 'object' && typeof owner !== 'function') {
        return true;
    }

    const unrealObject = owner as UnrealObjectLike;
    if (typeof unrealObject.IsValid === 'function') {
        return unrealObject.IsValid();
    }

    try {
        return UE.KismetSystemLibrary.IsValid(owner as UE.Object);
    } catch {
        return true;
    }
}

/** owner 有效时执行 fn, 否则返回 undefined. */
export function guardOwner<T>(owner: object, _scope: string, fn: () => T): T | undefined {
    if (!isOwnerValid(owner)) {
        return undefined;
    }

    return fn();
}

/** await 前后各检查一次 owner; owner 失效时返回 undefined. */
export async function guardOwnerAsync<T>(owner: object, _scope: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (!isOwnerValid(owner)) {
        return undefined;
    }

    const result = await fn();
    if (!isOwnerValid(owner)) {
        return undefined;
    }

    return result;
}
