/**
 * UE 委托 (Delegate) 绑定与释放管理.
 *
 * Mixin 在 ReceiveBeginPlay 中通过 {@link DelegateBag.bind} 注册组件事件 (如 Overlap),
 * 在 ReceiveEndPlay 中调用 {@link DelegateBag.clear} 统一解绑, 避免泄漏与悬空回调.
 * 禁止手写裸 `.Add(this.onXxx.bind(this))`: 每次 bind 生成新函数引用, Remove 无法匹配.
 */

type DelegateCallback = (...args: any[]) => void;

/** 具备 Add / Remove 的 UE 委托对象 (如 OnComponentBeginOverlap). */
export interface RemovableDelegate<TCallback extends DelegateCallback> {
    Add(callback: TCallback): unknown;
    Remove(callback: TCallback): unknown;
}

export class DelegateBag {
    /** 与 Add 成对的 Remove 闭包, clear 时逆序执行. */
    private readonly removers: Array<() => void> = [];

    /**
     * 注册委托回调并记录解绑闭包.
     * @param callback 已绑定 this 的函数引用; 若需 bind, 请用 {@link DelegateBag.bind}.
     */
    add<TCallback extends DelegateCallback>(delegate: RemovableDelegate<TCallback>, callback: TCallback): TCallback {
        delegate.Add(callback);
        // 闭包捕获 Add 时传入的 callback 引用, 保证 Remove 能命中同一函数.
        this.removers.push(() => delegate.Remove(callback));
        return callback;
    }

    /**
     * 绑定 owner 后注册委托; Mixin 中推荐用法.
     * @param owner 一般为 Mixin 实例 (this).
     */
    bind<TCallback extends DelegateCallback>(
        delegate: RemovableDelegate<TCallback>,
        owner: unknown,
        callback: TCallback
    ): TCallback {
        return this.add(delegate, callback.bind(owner) as TCallback);
    }

    /** 逆序解绑所有已注册委托, 通常在 ReceiveEndPlay / clearMixinRuntimeState 中调用. */
    clear(): void {
        for (let index = this.removers.length - 1; index >= 0; --index) {
            this.removers[index]();
        }
        this.removers.length = 0;
    }
}
