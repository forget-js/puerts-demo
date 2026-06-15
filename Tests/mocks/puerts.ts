/**
 * Vitest 的 puerts 模块替身.
 *
 * Node 单测只验证 TypeScript HTTP 逻辑, 不运行真实 Puerts VM; 这里提供最小 API,
 * 让 Runtime 代码可以被 import, 但不模拟 UE/Puerts 的运行时行为.
 */
export function $ref<T>(): T {
    return undefined as T;
}

export function toManualReleaseDelegate<TCallback>(callback: TCallback): TCallback {
    return callback;
}

export function releaseManualReleaseDelegate(callback: unknown): void {
    void callback;
    // Puerts 手动释放委托仅在 UE 运行时生效; Node 单测中无需处理.
}
