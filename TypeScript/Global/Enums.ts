/**
 * 全局枚举 GE.
 *
 * 与 GF.Log 配合使用; Mixin 中应 `import { GE } from '.../Global'`, 勿零散 import LogLevel.
 */

export enum LogLevel {
    Verbose = 0,
    Log = 1,
    Warning = 2,
    Error = 3,
}

/** 全局枚举命名空间, 便于 `GE.LogLevel` 形式引用. */
export const GE = {
    LogLevel,
} as const;
