/**
 * 启动与模块执行的错误边界.
 *
 * 提供 runSafely 包裹同步调用、reportError 统一日志格式, 以及全局 onerror /
 * onunhandledrejection 兜底; 由 Bootstrap 在启动最早阶段 installGlobalErrorHandlers.
 */

import { GF } from '../Global';

export interface ErrorBoundaryOptions {
    /** 默认 true: 记录后重新抛出, 便于上层感知失败. */
    rethrow?: boolean;
}

const LOGGER = GF.CreateLogger('ErrorBoundary');

let globalHandlersInstalled = false;

/**
 * 将错误写入控制台, scope 用于定位调用来源 (如 GameModule.Foo.init).
 */
export function reportError(scope: string, error: unknown): void {
    LOGGER.Error('Unhandled error', {
        context: { scope },
        error,
        toScreen: false,
    });
}

/**
 * 执行 fn 并捕获异常; 默认记录后 rethrow.
 * @param scope 错误日志中的上下文标识.
 */
export function runSafely<T>(scope: string, fn: () => T, options: ErrorBoundaryOptions = {}): T | undefined {
    try {
        return fn();
    } catch (error) {
        reportError(scope, error);
        if (options.rethrow ?? true) {
            throw error;
        }
        return undefined;
    }
}

/** 安装全局未捕获错误处理器; 重复调用无副作用, 会链式保留既有 handler. */
export function installGlobalErrorHandlers(): void {
    if (globalHandlersInstalled) {
        return;
    }

    globalHandlersInstalled = true;
    const globalObject = globalThis as {
        onerror?: (...args: unknown[]) => unknown;
        onunhandledrejection?: (event: unknown) => unknown;
    };

    const previousOnError = globalObject.onerror;
    globalObject.onerror = (...args: unknown[]) => {
        reportError('global.onerror', args);
        if (typeof previousOnError === 'function') {
            return previousOnError(...args);
        }
        return false;
    };

    const previousOnUnhandledRejection = globalObject.onunhandledrejection;
    globalObject.onunhandledrejection = (event: unknown) => {
        reportError('global.onunhandledrejection', event);
        if (typeof previousOnUnhandledRejection === 'function') {
            return previousOnUnhandledRejection(event);
        }
        return undefined;
    };
}
