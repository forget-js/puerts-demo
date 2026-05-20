export enum LogLevel {
    Verbose = 0,
    Log = 1,
    Warning = 2,
    Error = 3,
}

export const GE = {
    LogLevel,
} as const;
