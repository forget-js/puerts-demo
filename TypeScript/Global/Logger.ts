/**
 * 日志系统核心实现.
 *
 * Function.ts 只保留 GF 的统一入口和便捷封装; 日志格式化、上下文、输出 sink 与限流在此维护.
 */

import * as UE from 'ue';

import { Config } from '../Config/Config';
import { LogLevel } from './Enums';

/** 与 LogLevel 枚举下标一一对应的输出标签 */
const LEVEL_LABEL = ['Verbose', 'Log', 'Warning', 'Error'] as const;

/** 各日志级别对应的控制台输出函数 */
const CONSOLE_BY_LEVEL: Record<LogLevel, (message: string) => void> = {
    [LogLevel.Verbose]: (message) => console.log(message),
    [LogLevel.Log]: (message) => console.log(message),
    [LogLevel.Warning]: (message) => console.warn(message),
    [LogLevel.Error]: (message) => console.error(message),
};

/** UE PrintString 屏幕输出时各级别默认颜色 */
const SCREEN_COLOR_BY_LEVEL: Record<LogLevel, UE.LinearColor> = {
    [LogLevel.Verbose]: new UE.LinearColor(0.5, 0.5, 0.5, 1),
    [LogLevel.Log]: new UE.LinearColor(0, 0.66, 1, 1),
    [LogLevel.Warning]: new UE.LinearColor(1, 0.85, 0, 1),
    [LogLevel.Error]: new UE.LinearColor(1, 0.1, 0.1, 1),
};

/** Actor/类实例 → 已注册的日志上下文，随对象 GC 自动释放 */
const registeredLogContexts = new WeakMap<object, RegisteredLogContext>();
/** once 去重：已输出过的日志 key 集合，进程生命周期内不重置 */
const onceLogKeys = new Set<string>();
/** 限流去重：key → 上次输出时间戳 (ms)，进程生命周期内不重置 */
const rateLimitedLogTimes = new Map<string, number>();

/** 通过 registerLogContext / bindLogContext 绑定的日志上下文 */
export interface RegisteredLogContext {
    /** 显示在日志前缀中的名称，如 Actor 类名 */
    readonly displayName: string;
    /** 模块名，用于 Config.log.moduleMinLevel 分级过滤 */
    readonly module?: string;
}

/** emitLog / GF.Log 的可选参数，均可与 registerLogContext 注册的默认值叠加 */
export interface LogOptions {
    /** 未指定时默认为 LogLevel.Log */
    level?: LogLevel;
    /** 传入 UE.Object 时启用屏幕输出并作为 PrintString 的 world context */
    worldContext?: UE.Object | null;
    /** 是否输出到 UE 屏幕，默认有 worldContext 且非 Shipping 时开启 */
    toScreen?: boolean;
    /** 是否输出到控制台，默认 true */
    toLog?: boolean;
    /** 覆盖模块名，参与分级过滤与去重 key 生成 */
    module?: string;
    /** 覆盖显示名，出现在 `[Level] [displayName]` 前缀中 */
    displayName?: string;
    /** 附加结构化数据，序列化后追加到消息末尾 */
    context?: Record<string, unknown>;
    /** 附加错误对象，Error 优先输出 stack */
    error?: unknown;
    /** PrintString 屏幕显示时长 (秒)，默认 2 */
    duration?: number;
    color?: UE.LinearColor;
    /** 去重/限流用的自定义 key，默认使用 message */
    key?: string;
    /** 同一 key 的最小输出间隔 (秒)，未指定时用 Config.log.rateLimitDefaults */
    rateLimitSeconds?: number;
    /** 同一 key 生命周期内只输出一次 */
    once?: boolean;
}

/** Actor 便捷重载用，worldContext 由第一个参数传入 */
export type LogOptionsWithoutContext = Omit<LogOptions, 'worldContext'>;

/** createLogger 返回的具名日志器，自动填充 displayName / module */
export interface Logger {
    Log(message: string, options?: LogOptions): void;
    Verbose(message: string, options?: LogOptions): void;
    Warn(message: string, options?: LogOptions): void;
    Error(message: string, options?: LogOptions): void;
}

/** 支持 (message, options?) 与 (worldContext, message, options?) 两种调用形态 */
export interface LevelLogFunction {
    (message: string, options?: LogOptions): void;
    (worldContext: UE.Object, message: string, options?: LogOptionsWithoutContext): void;
}

/** GF.Log 的统一函数签名，兼容历史多参数重载 */
export interface LogFunction {
    (message: string, options?: LogOptions): void;
    (worldContext: UE.Object, message: string): void;
    (worldContext: UE.Object, message: string, level: LogLevel): void;
    (worldContext: UE.Object, message: string, level: LogLevel, module: string): void;
    (worldContext: UE.Object, message: string, options: LogOptionsWithoutContext): void;
}

/** GF.LogPrettyJson: 按行输出格式化 JSON */
export interface LogPrettyJsonFunction {
    (label: string, value: unknown, options?: LogOptions): void;
    (worldContext: UE.Object, label: string, value: unknown, options?: LogOptionsWithoutContext): void;
}

/** 将日志上下文绑定到指定对象（通常为 Actor 实例或类构造函数） */
export function registerLogContext(target: object, context: RegisteredLogContext): void {
    registeredLogContexts.set(target, context);
}

/** registerLogContext 的安全包装，忽略 null / 原始类型 */
export function bindLogContext(target: unknown, context: RegisteredLogContext): void {
    if ((typeof target === 'object' && target !== null) || typeof target === 'function') {
        registeredLogContexts.set(target, context);
    }
}

/** 校验 level 是否为合法 LogLevel 下标，非法或缺失时回退到 Log */
function normalizeLevel(level?: LogLevel): LogLevel {
    return level !== undefined && LEVEL_LABEL[level] !== undefined ? level : LogLevel.Log;
}

/** 计算当前模块应使用的最低日志级别；Shipping 包额外抬高下限 */
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

/** 将 context / error 附加字段序列化为单行字符串，Error 优先保留 stack */
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

/**
 * 从 worldContext 解析已注册的日志上下文.
 * 沿原型链向上查找，以支持在类构造函数上注册、实例调用时自动继承.
 */
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

    // 原型链未命中时，再查一次 constructor（兼容仅绑定在类上的注册）
    const constructor = (target as { constructor?: object }).constructor;
    return constructor ? registeredLogContexts.get(constructor) : undefined;
}

/**
 * 合并显式 options 与已注册上下文，显式字段优先.
 * displayName: options > registered > options.module
 * module: options > registered > displayName
 */
function resolveLogContext(options: LogOptions): RegisteredLogContext {
    const registered = resolveRegisteredLogContext(options.worldContext);
    const displayName = options.displayName ?? registered?.displayName ?? options.module;
    const module = options.module ?? registered?.module ?? displayName;

    return {
        displayName: displayName ?? '',
        module,
    };
}

/** 组装最终输出文本：`[Level] [displayName] message [context] [error]` */
function formatLogMessage(
    message: string,
    level: LogLevel,
    context: RegisteredLogContext,
    options: LogOptions
): string {
    const label = LEVEL_LABEL[level] ?? 'Log';
    const prefix = context.displayName ? `[${label}] [${context.displayName}]` : `[${label}]`;
    const details = [
        options.context !== undefined ? safeStringify(options.context) : undefined,
        options.error !== undefined ? safeStringify(options.error) : undefined,
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);

    return details.length > 0 ? `${prefix} ${message} ${details.join(' ')}` : `${prefix} ${message}`;
}

/** 决定控制台与 UE 屏幕的输出开关，显式 toScreen / toLog 可覆盖默认策略 */
function resolveLogTargets(level: LogLevel, options: LogOptions): { toScreen: boolean; toLog: boolean } {
    const hasWorldContext = options.worldContext !== undefined && options.worldContext !== null;
    const defaultToScreen =
        hasWorldContext &&
        Config.app.environment !== 'Shipping' &&
        Config.log.showScreenLogs &&
        level >= Config.log.screenMinLevel;

    // Mixin 常见调用 GF.Log(this, '...')：默认同时打到屏幕和日志。
    // 无 worldContext 时，默认仅输出控制台，避免无效 PrintString 调用。
    return {
        toScreen: options.toScreen ?? defaultToScreen,
        toLog: options.toLog ?? true,
    };
}

/** 生成 once / rateLimit 去重用的复合 key：module|level|keyOrMessage */
function makeLogKey(message: string, level: LogLevel, context: RegisteredLogContext, options: LogOptions): string {
    return [context.module ?? context.displayName, LEVEL_LABEL[level] ?? 'Log', options.key ?? message].join('|');
}

/**
 * 根据 once / rateLimit 判断是否应跳过本次输出.
 * 仅设置 key 也会进入限流路径，间隔取 Config.log.rateLimitDefaults.
 */
function shouldSuppressByFrequency(
    message: string,
    level: LogLevel,
    context: RegisteredLogContext,
    options: LogOptions
): boolean {
    if (!options.once && !options.key && options.rateLimitSeconds === undefined) {
        return false;
    }

    const key = makeLogKey(message, level, context, options);
    if (options.once && onceLogKeys.has(key)) {
        return true;
    }

    const rateLimitSeconds = options.rateLimitSeconds ?? Config.log.rateLimitDefaults.seconds;
    // <= 0 表示关闭时间窗口限流，但仍会记录 once
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

/** 日志核心出口：过滤 → 格式化 → 控制台 / UE 屏幕双通道输出 */
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
        // PrintString: bPrintToScreen=true, bPrintToLog=false（控制台已由上方 toLog 分支负责）
        UE.KismetSystemLibrary.PrintString(
            options.worldContext ?? null,
            formatted,
            true,
            false,
            color,
            options.duration ?? 2
        );
    }
}

/**
 * 将 GF.Log 多种重载形态归一化为 { message, options }.
 * 支持 Log(msg)、Log(actor, msg)、Log(actor, msg, level)、Log(actor, msg, level, module) 等.
 */
function normalizeLogArgs(
    arg0: string | UE.Object,
    arg1?: string | LogOptions | LogOptionsWithoutContext,
    arg2?: LogLevel | LogOptionsWithoutContext,
    arg3?: string
): { message: string; options: LogOptions } {
    // Log(message) / Log(message, options)
    if (typeof arg0 === 'string') {
        const options = typeof arg1 === 'object' && arg1 !== null ? (arg1 as LogOptions) : {};

        return { message: arg0, options };
    }

    const worldContext = arg0;
    const message = typeof arg1 === 'string' ? arg1 : '';

    // Log(actor, message)
    if (arg2 === undefined) {
        return { message, options: { worldContext } };
    }

    // Log(actor, message, level, module?)
    if (typeof arg2 === 'number') {
        return { message, options: { worldContext, level: arg2, module: arg3 } };
    }

    // Log(actor, message, options)
    return { message, options: { ...arg2, worldContext } };
}

function logPrettyJsonLines(label: string, value: unknown, options: LogOptions = {}): void {
    const logOptions: LogOptions = { toScreen: false, ...options };

    let pretty: string;
    try {
        pretty = JSON.stringify(value, null, 2);
    } catch {
        emitLog(`${label} ${String(value)}`, logOptions);
        return;
    }

    for (const line of pretty.split('\n')) {
        emitLog(`${label} ${line}`, logOptions);
    }
}

/**
 * 按行输出 indent 后的 JSON; Output Log 不自动换行, 避免单行过长被截断.
 * 支持 LogPrettyJson(label, value, options?) 与 LogPrettyJson(actor, label, value, options?).
 */
export function logPrettyJsonWithArgs(
    arg0: string | UE.Object,
    arg1: string | unknown,
    arg2?: unknown | LogOptions | LogOptionsWithoutContext,
    arg3?: LogOptionsWithoutContext
): void {
    if (typeof arg0 === 'string') {
        const label = arg0;
        const value = arg1;
        const options = typeof arg2 === 'object' && arg2 !== null ? (arg2 as LogOptions) : {};
        logPrettyJsonLines(label, value, options);
        return;
    }

    const label = typeof arg1 === 'string' ? arg1 : '';
    logPrettyJsonLines(label, arg2, { ...(arg3 ?? {}), worldContext: arg0 });
}

/** GF.Log 的实现入口，委托 normalizeLogArgs + emitLog */
export function logWithArgs(
    arg0: string | UE.Object,
    arg1?: string | LogOptions | LogOptionsWithoutContext,
    arg2?: LogLevel | LogOptionsWithoutContext,
    arg3?: string
): void {
    const { message, options } = normalizeLogArgs(arg0, arg1, arg2, arg3);
    emitLog(message, options);
}

/** GF.LogVerbose / LogWarn / LogError 等定级入口 */
export function logWithLevel(
    level: LogLevel,
    arg0: string | UE.Object,
    arg1?: string | LogOptions | LogOptionsWithoutContext,
    arg2?: LogOptionsWithoutContext
): void {
    // LogVerbose(message) / LogVerbose(message, options)
    if (typeof arg0 === 'string') {
        const options = typeof arg1 === 'object' && arg1 !== null ? (arg1 as LogOptions) : {};
        emitLog(arg0, { ...options, level });
        return;
    }

    // LogVerbose(actor, message) / LogVerbose(actor, message, options)
    const message = typeof arg1 === 'string' ? arg1 : '';
    emitLog(message, { ...(arg2 ?? {}), worldContext: arg0, level });
}

/** 创建带固定 displayName / module 前缀的模块级日志器 */
export function createLogger(displayName: string): Logger {
    // 调用方未显式传入时，自动补上 displayName / module 前缀
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
