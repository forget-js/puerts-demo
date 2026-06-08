/**
 * 全局函数 GF: 统一日志入口.
 *
 * Mixin 中通过 `import { GF, GE } from '.../Global'` 使用; 阈值与上屏行为由 Config.log 控制.
 */

import * as UE from 'ue';
import { $ref } from 'puerts';

import { Config } from '../Config/Config';
import { ScriptBuildInfo } from '../Runtime';
import { LogLevel } from './Enums';

const LEVEL_LABEL = ['Verbose', 'Log', 'Warning', 'Error'] as const;

const CONSOLE_BY_LEVEL: Record<LogLevel, (message: string) => void> = {
    [LogLevel.Verbose]: (message) => console.log(message),
    [LogLevel.Log]: (message) => console.log(message),
    [LogLevel.Warning]: (message) => console.warn(message),
    [LogLevel.Error]: (message) => console.error(message),
};

export interface LogOptions {
    level?: LogLevel;
    worldContext?: UE.Object | null;
    toScreen?: boolean;
    toLog?: boolean;
    module?: string;
    duration?: number;
    color?: UE.LinearColor;
    key?: string;
}

export interface SetActorLocationOptions {
    readonly sweep?: boolean;
    readonly teleport?: boolean;
}

/** Actor 便捷重载用，worldContext 由第一个参数传入 */
export type LogOptionsWithoutContext = Omit<LogOptions, 'worldContext'>;

function normalizeLevel(level?: LogLevel): LogLevel {
    return level !== undefined && LEVEL_LABEL[level] !== undefined ? level : LogLevel.Log;
}

/** module 在 Config.log.moduleMinLevel 中有条目时, 以模块阈值为准, 否则用 globalMinLevel. */
function shouldLog(level: LogLevel, module?: string): boolean {
    const min =
        module !== undefined && Config.log.moduleMinLevel[module] !== undefined
            ? Config.log.moduleMinLevel[module]
            : Config.log.globalMinLevel;

    return level >= min;
}

function formatLogMessage(message: string, level: LogLevel, module?: string): string {
    const body = message.replace(/-{4,}/g, (match) => '='.repeat(match.length));
    const label = LEVEL_LABEL[level] ?? 'Log';
    const context = [
        Config.app.environment,
        ScriptBuildInfo.version,
        module,
        label,
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);
    const prefix = context.map((item) => `[${item}]`).join('');

    return level === LogLevel.Error ? `${prefix} Error: ${body}` : `${prefix} ${body}`;
}

function resolveLogTargets(options: LogOptions): { toScreen: boolean; toLog: boolean } {
    const hasWorldContext = options.worldContext !== undefined && options.worldContext !== null;

    // Mixin 常见调用 GF.Log(this, '...')：默认同时打到屏幕和日志。
    // 无 worldContext 时，默认仅输出控制台，避免无效 PrintString 调用。
    return {
        toScreen: options.toScreen ?? (hasWorldContext && Config.log.showScreenLogs),
        toLog: options.toLog ?? true,
    };
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

function Log(message: string, options: LogOptions = {}): void {
    const level = normalizeLevel(options.level);
    const module = options.module;

    if (!shouldLog(level, module)) {
        return;
    }

    const formatted = formatLogMessage(message, level, module);
    const { toScreen, toLog } = resolveLogTargets(options);

    if (toScreen) {
        const color = options.color ?? new UE.LinearColor(0, 0.66, 1, 1);
        UE.KismetSystemLibrary.PrintString(options.worldContext ?? null, formatted, true, toLog, color, options.duration ?? 2);
        return;
    }

    if (toLog) {
        CONSOLE_BY_LEVEL[level](formatted);
    }
}

export interface GlobalFunction {
    GetActorLocation(actor: UE.Actor): UE.Vector;

    SetActorLocation(actor: UE.Actor, location: UE.Vector, options?: SetActorLocationOptions): boolean;

    /** 仅 Output Log */
    Log(message: string, options?: LogOptions): void;

    /** Mixin 常用：默认 level = Log */
    Log(worldContext: UE.Object, message: string): void;
    Log(worldContext: UE.Object, message: string, level: LogLevel): void;

    /** 需配合 Config.log.moduleMinLevel 时使用 */
    Log(worldContext: UE.Object, message: string, level: LogLevel, module: string): void;
    Log(worldContext: UE.Object, message: string, options: LogOptionsWithoutContext): void;
}

export const GF: GlobalFunction = {
    GetActorLocation(actor: UE.Actor): UE.Vector {
        return actor.K2_GetActorLocation();
    },

    SetActorLocation(actor: UE.Actor, location: UE.Vector, options: SetActorLocationOptions = {}): boolean {
        return actor.K2_SetActorLocation(
            location,
            options.sweep ?? false,
            $ref<UE.HitResult>(),
            options.teleport ?? true
        );
    },

    Log(
        arg0: string | UE.Object,
        arg1?: string | LogOptions | LogOptionsWithoutContext,
        arg2?: LogLevel | LogOptionsWithoutContext,
        arg3?: string
    ): void {
        const { message, options } = normalizeLogArgs(arg0, arg1, arg2, arg3);
        Log(message, options);
    },
};


