/**
 * 全局 Post-only 消息总线 (对齐 CodeFormat 第 7 节).
 *
 * 大模块之间通过 Messages 常量 + EventBus.post 通信; 同步 Send 未实现.
 */

import { runSafely } from '../../Runtime';

export type EventHandler = (sender: unknown, payload: unknown) => void;

type Subscription = {
    readonly messageName: string;
    readonly handler: EventHandler;
};

const subscriptions: Subscription[] = [];

/** 订阅消息; 返回取消订阅函数. */
export function subscribe(messageName: string, handler: EventHandler): () => void {
    const subscription: Subscription = { messageName, handler };
    subscriptions.push(subscription);

    return () => {
        const index = subscriptions.indexOf(subscription);
        if (index >= 0) {
            subscriptions.splice(index, 1);
        }
    };
}

/** 取消指定 handler 的全部订阅. */
export function unsubscribe(handler: EventHandler): void {
    for (let index = subscriptions.length - 1; index >= 0; --index) {
        if (subscriptions[index].handler === handler) {
            subscriptions.splice(index, 1);
        }
    }
}

/** 清空全部订阅 (Feature dispose 或单测). */
export function clearAllSubscriptions(): void {
    subscriptions.length = 0;
}

/**
 * 异步投递消息; handler 经 runSafely 包裹.
 * @param sender 发送方, 一般为 Mixin 实例 this.
 */
export function post(sender: unknown, messageName: string, payload: unknown = {}): void {
    const matched = subscriptions.filter((item) => item.messageName === messageName);

    for (const subscription of matched) {
        runSafely(`EventBus.${messageName}`, () => subscription.handler(sender, payload));
    }
}

/** 同步 Send 需 Code Review 审批, 当前未实现. */
export function send(_sender: unknown, _messageName: string, _payload: unknown = {}): never {
    throw new Error('EventBus.send is not implemented; use post() or get explicit approval for synchronous dispatch.');
}
