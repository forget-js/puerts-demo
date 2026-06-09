/**
 * 日志系统核心实现.
 *
 * Function.ts 只保留 GF 的统一入口和便捷封装; 日志格式化、上下文、输出 sink 与限流在此维护.
 */

import * as UE from 'ue';

import { Config } from '../Config/Config';
import { LogLevel } from './Enums';

const LEVEL_LABEL = ['Verbose', 'Log', 'Warning', 'Error'] as const;

const CONSOLE_BY_LEVEL: Record<LogLevel, (message: string) => void> = {
    [LogLevel.Verbose]: (message) => console.log(message),
    [LogLevel.Log]: (message) => console.log(message),
    [LogLevel.Warning]: (message) => console.warn(message),
    [LogLevel.Error]: (message) => console.error(message),
};

const SCREEN_COLOR_BY_LEVEL: Record<LogLevel, UE.LinearColor> = {
    [LogLevel.Verbose]: new UE.LinearColor(0.5, 0.5, 0.5, 1),
    [LogLevel.Log]: new UE.LinearColor(0, 0.66, 1, 1),
    [LogLevel.Warning]: new UE.LinearColor(1, 0.85, 0, 1),
    [LogLevel.Error]: new UE.LinearColor(1, 0.1, 0.1, 1),
};

const registeredLogContexts = new WeakMap<object, RegisteredLogContext>();
const onceLogKeys = new Set<string>();
const rateLimitedLogTimes = new Map<string, number>();

export interface RegisteredLogContext {
    readonly displayName: string;
    readonly module?: string;
}

export interface LogOptions {
    level?: LogLevel;
    worldContext?: UE.Object | null;
    toScreen?: boolean;
    toLog?: boolean;
    module?: string;
    displayName?: string;
    context?: Record<string, unknown>;
    error?: unknown;
    duration?: number;
    color?: UE.LinearColor;
    key?: string;
    rateLimitSeconds?: number;
    once?: boolean;
}

/** Actor 便捷重载用，worldContext 由第一个参数传入 */
export type LogOptionsWithoutContext = Omit<LogOptions, 'worldContext'>;

export interface Logger {
    Log(message: string, options?: LogOptions): void;
    Verbose(message: string, options?: LogOptions): void;
    Warn(message: string, options?: LogOptions): void;
    Error(message: string, options?: LogOptions): void;
}

export interface LevelLogFunction {
    (message: string, options?: LogOptions): void;
    (worldContext: UE.Object, message: string, options?: LogOptionsWithoutContext): void;
}

export interface LogFunction {
    (message: string, options?: LogOptions): void;
    (worldContext: UE.Object, message: string): void;
    (worldContext: UE.Object, message: string, level: LogLevel): void;
    (worldContext: UE.Object, message: string, level: LogLevel, module: string): void;
    (worldContext: UE.Object, message: string, options: LogOptionsWithoutContext): void;
}

export function registerLogContext(target: object, context: RegisteredLogContext): void {
    registeredLogContexts.set(target, context);
}

export function bindLogContext(target: unknown, context: RegisteredLogContext): void {
    if ((typeof target === 'object' && target !== null) || typeof target === 'function') {
        registeredLogContexts.set(target, context);
    }
}

function normalizeLevel(level?: LogLevel): LogLevel {
    return level !== undefined && LEVEL_LABEL[level] !== undefined ? level : LogLevel.Log;
}

function getEffectiveMinLevel(module?: string): LogLevel {
    const configuredMin =
        module !== undefined && Config.log.moduleMinLevel[module] !== undefined
            ? Config.log.moduleMinLevel[module]
            : Config.log.globalMinLevel;

    if (Config.app.environment !== 'Shipping') {
        return configuredMin;
    }

    return Math.max(configuredMin, Config.log.shippingMinLevel) as LogLevel;
}

/** module 在 Config.log.moduleMinLevel 中有条目时, 以模块阈值为准, 否则用 globalMinLevel. */
function shouldLog(level: LogLevel, module?: string): boolean {
    return level >= getEffectiveMinLevel(module);
}

function safeStringify(value: unknown): string {
    if (value instanceof Error) {
        return value.stack ?? value.message;
    }

    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function resolveRegisteredLogContext(target: unknown): RegisteredLogContext | undefined {
    if ((typeof target !== 'object' || target === null) && typeof target !== 'function') {
        return undefined;
    }

    let current: object | null = target;
    while (current) {
        const context = registeredLogContexts.get(current);
        if (context) {
            return context;
        }

        current = Object.getPrototypeOf(current);
    }

    const constructor = (target as { constructor?: object }).constructor;
    return constructor ? registeredLogContexts.get(constructor) : undefined;
}

function resolveLogContext(options: LogOptions): RegisteredLogContext {
    const registered = resolveRegisteredLogContext(options.worldContext);
    const displayName = options.displayName ?? registered?.displayName ?? options.module;
    const module = options.module ?? registered?.module ?? displayName;

    return {
        displayName: displayName ?? '',
        module,
    };
}

function formatLogMessage(message: string, level: LogLevel, context: RegisteredLogContext, options: LogOptions): string {
    const label = LEVEL_LABEL[level] ?? 'Log';
    const prefix = context.displayName
        ? `[${label}] [${context.displayName}]`
        : `[${label}]`;
    const details = [
        options.context !== undefined ? safeStringify(options.context) : undefined,
        options.error !== undefined ? safeStringify(options.error) : undefined,
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);

    return details.length > 0 ? `${prefix} ${message} ${details.join(' ')}` : `${prefix} ${message}`;
}

function resolveLogTargets(level: LogLevel, options: LogOptions): { toScreen: boolean; toLog: boolean } {
    const hasWorldContext = options.worldContext !== undefined && options.worldContext !== null;
    const defaultToScreen =
        hasWorldContext
        && Config.app.environment !== 'Shipping'
        && Config.log.showScreenLogs
        && level >= Config.log.screenMinLevel;

    // Mixin 常见调用 GF.Log(this, '...')：默认同时打到屏幕和日志。
    // 无 worldContext 时，默认仅输出控制台，避免无效 PrintString 调用。
    return {
        toScreen: options.toScreen ?? defaultToScreen,
        toLog: options.toLog ?? true,
    };
}

function makeLogKey(message: string, level: LogLevel, context: RegisteredLogContext, options: LogOptions): string {
    return [
        context.module ?? context.displayName,
        LEVEL_LABEL[level] ?? 'Log',
        options.key ?? message,
    ].join('|');
}

function shouldSuppressByFrequency(message: string, level: LogLevel, context: RegisteredLogContext, options: LogOptions): boolean {
    if (!options.once && !options.key && options.rateLimitSeconds === undefined) {
        return false;
    }

    const key = makeLogKey(message, level, context, options);
    if (options.once && onceLogKeys.has(key)) {
        return true;
    }

    const rateLimitSeconds = options.rateLimitSeconds ?? Config.log.rateLimitDefaults.seconds;
    if (rateLimitSeconds <= 0) {
        if (options.once) {
            onceLogKeys.add(key);
        }
        return false;
    }

    const now = Date.now();
    const previous = rateLimitedLogTimes.get(key);
    if (previous !== undefined && now - previous < rateLimitSeconds * 1000) {
        return true;
    }

    rateLimitedLogTimes.set(key, now);
    if (options.once) {
        onceLogKeys.add(key);
    }
    return false;
}

export function emitLog(message: string, options: LogOptions = {}): void {
    const level = normalizeLevel(options.level);
    const context = resolveLogContext(options);

    if (!shouldLog(level, context.module) || shouldSuppressByFrequency(message, level, context, options)) {
        return;
    }

    const formatted = formatLogMessage(message, level, context, options);
    const { toScreen, toLog } = resolveLogTargets(level, options);

    if (toLog) {
        CONSOLE_BY_LEVEL[level](formatted);
    }

    if (toScreen) {
        const color = options.color ?? SCREEN_COLOR_BY_LEVEL[level];
        UE.KismetSystemLibrary.PrintString(options.worldContext ?? null, formatted, true, false, color, options.duration ?? 2);
    }
}

function normalizeLogArgs(
    arg0: string | UE.Object,
    arg1?: string | LogOptions | LogOptionsWithoutContext,
    arg2?: LogLevel | LogOptionsWithoutContext,
    arg3?: string
): { message: string; options: LogOptions } {
    if (typeof arg0 === 'string') {
        const options =
            typeof arg1 === 'object' && arg1 !== null ? (arg1 as LogOptions) : {};

        return { message: arg0, options };
    }

    const worldContext = arg0;
    const message = typeof arg1 === 'string' ? arg1 : '';

    if (arg2 === undefined) {
        return { message, options: { worldContext } };
    }

    if (typeof arg2 === 'number') {
        return { message, options: { worldContext, level: arg2, module: arg3 } };
    }

    return { message, options: { ...arg2, worldContext } };
}

export function logWithArgs(
    arg0: string | UE.Object,
    arg1?: string | LogOptions | LogOptionsWithoutContext,
    arg2?: LogLevel | LogOptionsWithoutContext,
    arg3?: string
): void {
    const { message, options } = normalizeLogArgs(arg0, arg1, arg2, arg3);
    emitLog(message, options);
}

export function logWithLevel(
    level: LogLevel,
    arg0: string | UE.Object,
    arg1?: string | LogOptions | LogOptionsWithoutContext,
    arg2?: LogOptionsWithoutContext
): void {
    if (typeof arg0 === 'string') {
        const options = typeof arg1 === 'object' && arg1 !== null ? (arg1 as LogOptions) : {};
        emitLog(arg0, { ...options, level });
        return;
    }

    const message = typeof arg1 === 'string' ? arg1 : '';
    emitLog(message, { ...(arg2 ?? {}), worldContext: arg0, level });
}

export function createLogger(displayName: string): Logger {
    const withDefaults = (options: LogOptions = {}): LogOptions => ({
        ...options,
        displayName: options.displayName ?? displayName,
        module: options.module ?? displayName,
    });

    return {
        Log(message: string, options: LogOptions = {}): void {
            emitLog(message, withDefaults(options));
        },

        Verbose(message: string, options: LogOptions = {}): void {
            emitLog(message, withDefaults({ ...options, level: LogLevel.Verbose }));
        },

        Warn(message: string, options: LogOptions = {}): void {
            emitLog(message, withDefaults({ ...options, level: LogLevel.Warning }));
        },

        Error(message: string, options: LogOptions = {}): void {
            emitLog(message, withDefaults({ ...options, level: LogLevel.Error }));
        },
    };
}
