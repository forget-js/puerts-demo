import type { HttpTask } from './types';

/**
 * 可取消 HTTP 任务的生命周期管理.
 *
 * Mixin 通过 HttpClient.request({ owner: this }) 间接登记任务;
 * ReceiveEndPlay 中 clearMixinRuntimeState 会调用 cancelAll, 避免对象销毁后继续回调.
 */
export class HttpRequestBag {
    private readonly tasks = new Set<HttpTask<unknown>>();

    /** 登记任务; 完成或失败后自动移出集合. */
    track<T>(task: HttpTask<T>): HttpTask<T> {
        const trackedTask = task as HttpTask<unknown>;
        this.tasks.add(trackedTask);

        task.then(
            () => this.tasks.delete(trackedTask),
            () => this.tasks.delete(trackedTask)
        );

        return task;
    }

    cancelAll(reason = 'Owner disposed'): void {
        const tasks = Array.from(this.tasks);
        this.tasks.clear();

        for (const task of tasks) {
            task.cancel(reason);
        }
    }

    get size(): number {
        return this.tasks.size;
    }
}
