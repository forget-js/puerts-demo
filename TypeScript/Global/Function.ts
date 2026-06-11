/**
 * 全局函数 GF: 统一日志入口.
 *
 * Mixin 中通过 `import { GF, GE } from '.../Global'` 使用; 阈值与上屏行为由 Config.log 控制.
 */

import * as UE from 'ue';
import { $ref } from 'puerts';

import { LogLevel } from './Enums';
import {
    createLogger,
    logPrettyJsonWithArgs,
    logWithArgs,
    logWithLevel,
    type LevelLogFunction,
    type LogFunction,
    type LogPrettyJsonFunction,
    type Logger,
    type LogOptions,
    type LogOptionsWithoutContext,
} from './Logger';

export interface SetActorLocationOptions {
    readonly sweep?: boolean;
    readonly teleport?: boolean;
}

export interface GlobalFunction {
    GetActorLocation(actor: UE.Actor): UE.Vector;

    SetActorLocation(actor: UE.Actor, location: UE.Vector, options?: SetActorLocationOptions): boolean;

    Log: LogFunction;

    Verbose: LevelLogFunction;
    Warn: LevelLogFunction;
    Error: LevelLogFunction;

    LogPrettyJson: LogPrettyJsonFunction;

    CreateLogger(displayName: string): Logger;
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
        logWithArgs(arg0, arg1, arg2, arg3);
    },

    Verbose(
        arg0: string | UE.Object,
        arg1?: string | LogOptions | LogOptionsWithoutContext,
        arg2?: LogOptionsWithoutContext
    ): void {
        logWithLevel(LogLevel.Verbose, arg0, arg1, arg2);
    },

    Warn(
        arg0: string | UE.Object,
        arg1?: string | LogOptions | LogOptionsWithoutContext,
        arg2?: LogOptionsWithoutContext
    ): void {
        logWithLevel(LogLevel.Warning, arg0, arg1, arg2);
    },

    Error(
        arg0: string | UE.Object,
        arg1?: string | LogOptions | LogOptionsWithoutContext,
        arg2?: LogOptionsWithoutContext
    ): void {
        logWithLevel(LogLevel.Error, arg0, arg1, arg2);
    },

    LogPrettyJson(
        arg0: string | UE.Object,
        arg1: string | unknown,
        arg2?: unknown | LogOptions | LogOptionsWithoutContext,
        arg3?: LogOptionsWithoutContext
    ): void {
        logPrettyJsonWithArgs(arg0, arg1, arg2, arg3);
    },

    CreateLogger(displayName: string): Logger {
        return createLogger(displayName);
    },
};
