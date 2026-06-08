/**
 * 默认运行时配置 (入库).
 *
 * 本地调试覆盖请复制 config.dev.example.ts 为 config.dev.ts, 勿直接改本文件.
 */

import { LogLevel } from '../../Global/Enums';

export type AppEnvironment = 'Development' | 'QA' | 'Shipping';

export interface AppConfig {
    app: {
        environment: AppEnvironment;
    };
    log: {
        globalMinLevel: LogLevel;
        moduleMinLevel: Record<string, LogLevel>;
        showScreenLogs: boolean;
    };
}

export const configDefault: AppConfig = {
    app: {
        environment: 'Development',
    },
    log: {
        globalMinLevel: LogLevel.Log,
        moduleMinLevel: {},
        showScreenLogs: true,
    },
};
