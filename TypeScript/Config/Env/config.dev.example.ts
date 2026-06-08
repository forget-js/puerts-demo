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
        moduleMinLevel: {
            'Mixins/Blueprints/Actors/BP_Actor': LogLevel.Verbose,
        },
    },
};
