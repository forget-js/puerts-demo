/**
 * 默认运行时配置 (入库).
 *
 * 本地调试覆盖写入 config.dev.ts (npm install 时从 config.dev.example.ts 自动生成), 勿直接改本文件.
 */

import { LogLevel } from '../../Global/Enums';

export type AppEnvironment = 'Development' | 'QA' | 'Shipping';
export type HttpRetryMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface AppConfig {
    app: {
        environment: AppEnvironment;
    };
    log: {
        globalMinLevel: LogLevel;
        moduleMinLevel: Record<string, LogLevel>;
        showScreenLogs: boolean;
        screenMinLevel: LogLevel;
        shippingMinLevel: LogLevel;
        rateLimitDefaults: {
            seconds: number;
        };
    };
    http: {
        baseUrl: string;
        timeoutMs: number;
        defaultHeaders: Record<string, string>;
        retry: {
            attempts: number;
            baseDelayMs: number;
            maxDelayMs: number;
            retryMethods: HttpRetryMethod[];
            retryStatusCodes: number[];
        };
    };
    features: {
        devHttp: {
            enabled: boolean;
        };
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
        screenMinLevel: LogLevel.Log,
        shippingMinLevel: LogLevel.Warning,
        rateLimitDefaults: {
            seconds: 0,
        },
    },
    /** HTTP 默认值; baseUrl 留空表示由 Api 层或环境配置覆盖. token 勿写入此处. */
    http: {
        baseUrl: '',
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
            enabled: false,
        },
    },
};
