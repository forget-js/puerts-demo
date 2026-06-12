import { LogLevel } from '../../Global/Enums';
import type { AppConfig } from './config.default';

/**
 * 本地开发配置模板（入库）.
 *
 * config.dev.ts 由 npm install / npm run gen:config-dev 从本文件自动生成（已 gitignore，勿提交）.
 * 直接修改 config.dev.ts 即可；不会被脚本覆盖.
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
        baseUrl: 'https://m1.apifoxmock.com/m1/7256272-6983470-default',
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
    features: {
        devHttp: {
            enabled: true,
        },
    },
};
