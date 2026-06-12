/**
 * 开发态 HTTP 联调 Feature: Mock / 真实 Transport 与示例请求序列.
 *
 * 仅 Development + Config.features.devHttp.enabled 时生效; Mixin 不得直接 setTransport.
 */

import { Config } from '../../../Config/Config';
import { GF } from '../../../Global';
import type { GameModule } from '../../../Runtime';
import { UnrealHttpTransport } from '../../../Runtime';
import { Api, setTransportForDev } from '../../Services/Api';
import { setupTestMockTransport } from '../../Services/test.mock';
import { runConeUserFlow } from './runners/runConeUserFlow';
import { runCubeMockFlow } from './runners/runCubeMockFlow';

const LOGGER = GF.CreateLogger('DevHttp');

class DevHttpService {
    private activeFlow: 'mock' | 'real' | undefined;

    init(): void {
        if (!this.isEnabled()) {
            return;
        }

        LOGGER.Log('DevHttp feature enabled', { toScreen: false });
    }

    dispose(): void {
        if (this.activeFlow) {
            this.restoreDefaultTransport();
        }
    }

    isEnabled(): boolean {
        return Config.features.devHttp.enabled && Config.app.environment !== 'Shipping';
    }

    async runCubeMockFlow(owner: object): Promise<void> {
        if (!this.isEnabled()) {
            LOGGER.Verbose('DevHttp skipped: features.devHttp.enabled is false', { toScreen: false });
            return;
        }

        this.useMockTransport();
        try {
            await runCubeMockFlow(owner);
        } finally {
            this.restoreDefaultTransport();
        }
    }

    async runConeUserFlow(owner: object): Promise<void> {
        if (!this.isEnabled()) {
            LOGGER.Verbose('DevHttp skipped: features.devHttp.enabled is false', { toScreen: false });
            return;
        }

        this.useRealTransport();
        await runConeUserFlow(owner);
    }

    private useMockTransport(): void {
        setTransportForDev(setupTestMockTransport());
        this.activeFlow = 'mock';
    }

    private useRealTransport(): void {
        setTransportForDev(new UnrealHttpTransport());
        this.activeFlow = 'real';
    }

    private restoreDefaultTransport(): void {
        setTransportForDev(new UnrealHttpTransport());
        this.activeFlow = undefined;
        Api.init();
    }
}

export const DevHttp = new DevHttpService();

export const DevHttpModule: GameModule = {
    name: 'DevHttp',
    executionContext: 'Client',
    init(): void {
        DevHttp.init();
    },
    dispose(): void {
        DevHttp.dispose();
    },
};
