/**
 * 运动控制器协调: 注册表 + EventBus 订阅.
 *
 * UI / 其它模块通过 MOVEMENT_TOGGLE_REQUEST 发消息, 由本模块调用已注册 controller.
 */

import type { GameModule } from '../../../Runtime';
import { subscribe, unsubscribe } from '../../Core/EventBus';
import { MOVEMENT_TOGGLE_REQUEST, type MovementToggleRequestPayload } from '../../Messages/movement';

/** 可被 MovementControlModule 调度的控制器 (不泄漏 UE 类型). */
export interface MovementController {
    readonly controllerId: string;
    toggleMovementPaused(): boolean;
}

class MovementControlService {
    private readonly controllers = new Map<string, MovementController>();
    private defaultControllerId?: string;
    private boundHandler?: (sender: unknown, payload: unknown) => void;

    init(): void {
        if (this.boundHandler) {
            return;
        }

        this.boundHandler = (sender, payload) => {
            this.handleToggleRequest(payload as MovementToggleRequestPayload);
        };
        subscribe(MOVEMENT_TOGGLE_REQUEST.name, this.boundHandler);
    }

    dispose(): void {
        if (this.boundHandler) {
            unsubscribe(this.boundHandler);
            this.boundHandler = undefined;
        }

        this.controllers.clear();
        this.defaultControllerId = undefined;
    }

    registerController(controller: MovementController): void {
        this.controllers.set(controller.controllerId, controller);

        if (!this.defaultControllerId || this.controllers.size === 1) {
            this.defaultControllerId = controller.controllerId;
        }
    }

    unregisterController(controller: MovementController): void {
        this.controllers.delete(controller.controllerId);

        if (this.defaultControllerId === controller.controllerId) {
            const next = this.controllers.keys().next();
            this.defaultControllerId = next.done ? undefined : next.value;
        }
    }

    requestToggle(controllerId?: string): boolean | undefined {
        const resolvedId = controllerId ?? this.defaultControllerId;
        if (!resolvedId) {
            return undefined;
        }

        const controller = this.controllers.get(resolvedId);
        return controller?.toggleMovementPaused();
    }

    private handleToggleRequest(payload: MovementToggleRequestPayload): void {
        this.requestToggle(payload?.controllerId);
    }
}

export const MovementControl = new MovementControlService();

export const MovementControlModule: GameModule = {
    name: 'MovementControl',
    executionContext: 'Shared',
    init(): void {
        MovementControl.init();
    },
    dispose(): void {
        MovementControl.dispose();
    },
};
