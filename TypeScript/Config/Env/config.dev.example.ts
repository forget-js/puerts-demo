import { LogLevel } from '../../Global/Enums';
import type { AppConfig } from './config.default';

/**
 * 复制本文件为 config.dev.ts 后修改（config.dev.ts 已 gitignore，勿提交）。
 * 全局调高阈值可减少刷屏；对单个 module 单独放宽便于调试当前 Mixin。
 */
export const configDev: Partial<AppConfig> = {
    app: {
        environment: 'Development',
    },
    log: {
        globalMinLevel: LogLevel.Error,
        showScreenLogs: true,
        screenMinLevel: LogLevel.Log,
        shippingMinLevel: LogLevel.Warning,
        rateLimitDefaults: {
            seconds: 0,
        },
        moduleMinLevel: {
            BP_ConeActor: LogLevel.Verbose,
        },
    },
    /** 本地 API 地址; 复制为 config.dev.ts 后按实际后端修改. */
    http: {
        baseUrl: 'https://api.example.com',
        timeoutMs: 15000,
        defaultHeaders: {
            Accept: 'application/json',
        },
        retry: {
            attempts: 1,
            baseDelayMs: 250,
            maxDelayMs: 2000,
            retryMethods: ['GET', 'HEAD'],
            retryStatusCodes: [408, 429, 500, 502, 503, 504],
        },
    },
};
