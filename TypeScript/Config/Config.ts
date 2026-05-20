import { configDefault, type AppConfig } from './Env/config.default';
import { configDev } from './Env/config.dev';

function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    return {
        ...base,
        ...override,
        log: {
            ...base.log,
            ...override.log,
            moduleMinLevel: {
                ...base.log.moduleMinLevel,
                ...override.log?.moduleMinLevel,
            },
        },
    };
}

export const Config: AppConfig = mergeConfig(configDefault, configDev);

export const CC = Config;
