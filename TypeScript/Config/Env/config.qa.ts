import { LogLevel } from '../../Global/Enums';
import type { AppConfig } from './config.default';

/**
 * QA / 验收环境配置（入库）。
 *
 * 仅放非敏感配置；token、账号、证书等必须通过登录态或平台安全机制注入。
 */
export const configQa: Partial<AppConfig> = {
    app: {
        environment: 'QA',
    },
    log: {
        globalMinLevel: LogLevel.Log,
        moduleMinLevel: {},
        showScreenLogs: false,
        screenMinLevel: LogLevel.Warning,
        shippingMinLevel: LogLevel.Warning,
        rateLimitDefaults: {
            seconds: 1,
        },
    },
    http: {
        baseUrl: 'https://qa-api.example.com',
        timeoutMs: 15000,
        defaultHeaders: {
            Accept: 'application/json',
        },
        retry: {
            attempts: 2,
            baseDelayMs: 250,
            maxDelayMs: 2000,
            retryMethods: ['GET', 'HEAD'],
            retryStatusCodes: [408, 429, 500, 502, 503, 504],
        },
    },
    features: {
        devHttp: {
            enabled: false,
        },
    },
};
