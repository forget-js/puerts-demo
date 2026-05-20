import { LogLevel } from '../../Global/Enums';

export interface AppConfig {
    log: {
        globalMinLevel: LogLevel;
        moduleMinLevel: Record<string, LogLevel>;
    };
}

export const configDefault: AppConfig = {
    log: {
        globalMinLevel: LogLevel.Log,
        moduleMinLevel: {},
    },
};
