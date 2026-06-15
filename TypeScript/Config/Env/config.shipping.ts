import { LogLevel } from '../../Global/Enums';
import type { AppConfig } from './config.default';

/**
 * Shipping / 正式发布配置（入库）。
 *
 * 仅放非敏感配置；生产 token、账号、证书等不得写入脚本配置。
 */
export const configShipping: Partial<AppConfig> = {
    app: {
        environment: 'Shipping',
    },
    log: {
        globalMinLevel: LogLevel.Warning,
        moduleMinLevel: {},
        showScreenLogs: false,
        screenMinLevel: LogLevel.Error,
        shippingMinLevel: LogLevel.Warning,
        rateLimitDefaults: {
            seconds: 1,
        },
    },
    http: {
        baseUrl: 'https://api.example.com',
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
