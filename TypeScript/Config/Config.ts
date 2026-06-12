/**
 * 运行时配置合并与导出.
 *
 * 以 config.default 为基线, 叠加本地 config.dev (gitignore); 对外 export Config 与别名 CC.
 */

import { configDefault, type AppConfig } from './Env/config.default';
import { configDev } from './Env/config.dev';

/** 深度合并 app / log / http, key-value 配置按 key 叠加而非整体覆盖. */
function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    return {
        ...base,
        ...override,
        app: {
            ...base.app,
            ...override.app,
        },
        log: {
            ...base.log,
            ...override.log,
            moduleMinLevel: {
                ...base.log.moduleMinLevel,
                ...override.log?.moduleMinLevel,
            },
            rateLimitDefaults: {
                ...base.log.rateLimitDefaults,
                ...override.log?.rateLimitDefaults,
            },
        },
        http: {
            ...base.http,
            ...override.http,
            defaultHeaders: {
                ...base.http.defaultHeaders,
                ...override.http?.defaultHeaders,
            },
            retry: {
                ...base.http.retry,
                ...override.http?.retry,
            },
        },
        features: {
            ...base.features,
            ...override.features,
            devHttp: {
                ...base.features.devHttp,
                ...override.features?.devHttp,
            },
        },
    };
}

/** 合并后的运行时配置. */
export const Config: AppConfig = mergeConfig(configDefault, configDev);

/** Config 简写别名, 与历史 Lua/CC 命名习惯兼容. */
export const CC = Config;
