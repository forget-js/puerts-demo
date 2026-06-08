/**
 * setTimeout / setInterval 句柄管理与批量清理.
 *
 * Mixin 中替代裸用全局定时器: 在 ReceiveBeginPlay 中 schedule, 在 ReceiveEndPlay 中
 * 通过 clearMixinRuntimeState 调用 {@link TimerBag.clearAll} 取消所有未到期定时器.
 * 禁止在 ReceiveTick 及其调用链中用定时器驱动逻辑.
 */

type TimerHandle = ReturnType<typeof setTimeout>;

export class TimerBag {
    /** 一次性定时器句柄, 触发后自动从集合移除. */
    private readonly timeoutHandles = new Set<TimerHandle>();
    /** 循环定时器句柄, 须手动 clearInterval 或 clearAll 取消. */
    private readonly intervalHandles = new Set<TimerHandle>();

    /** 延迟执行一次; 回调触发后句柄自动移出管理集合. */
    setTimeout(callback: () => void, delayMilliseconds: number): TimerHandle {
        const handle = globalThis.setTimeout(() => {
            this.timeoutHandles.delete(handle);
            callback();
        }, delayMilliseconds);

        this.timeoutHandles.add(handle);
        return handle;
    }

    /** 按固定间隔循环执行, 须在 EndPlay 前 clearInterval 或 clearAll. */
    setInterval(callback: () => void, delayMilliseconds: number): TimerHandle {
        const handle = globalThis.setInterval(callback, delayMilliseconds);
        this.intervalHandles.add(handle);
        return handle;
    }

    clearTimeout(handle: TimerHandle): void {
        if (!this.timeoutHandles.delete(handle)) {
            return;
        }
        globalThis.clearTimeout(handle);
    }

    clearInterval(handle: TimerHandle): void {
        if (!this.intervalHandles.delete(handle)) {
            return;
        }
        globalThis.clearInterval(handle);
    }

    /** 取消本 Bag 管理的全部定时器, 通常在 ReceiveEndPlay 中调用. */
    clearAll(): void {
        for (const handle of this.timeoutHandles) {
            globalThis.clearTimeout(handle);
        }
        this.timeoutHandles.clear();

        for (const handle of this.intervalHandles) {
            globalThis.clearInterval(handle);
        }
        this.intervalHandles.clear();
    }
}
