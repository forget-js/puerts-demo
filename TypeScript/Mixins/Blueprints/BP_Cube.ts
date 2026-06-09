/**
 * [示例] BP_Cube: 本地旋转演示 (需 Tick).
 * DONE  1. ReceiveTick 驱动绕 Z 轴旋转 (蓝图 Event Graph 需启用 Tick)
 */
import * as UE from 'ue';
import { $ref } from 'puerts';
import {
    BP_CubeBlueprint,
    registerBlueprintMixin,
    type BlueprintInstance,
} from '../../Blueprints';

interface BP_CubeMixin extends BlueprintInstance<typeof BP_CubeBlueprint> { }
class BP_CubeMixin implements BP_CubeMixin {

    ReceiveBeginPlay(): void {
        console.log("=== ts log")
    }

    // 演示用途: 每帧按 DeltaSeconds 旋转; 正式业务应避免 Tick, 改用 Timer 或事件驱动.
    ReceiveTick(DeltaSeconds: number): void {
        this.K2_AddActorLocalRotation(new UE.Rotator(0, 0, DeltaSeconds * 10), false, $ref<UE.HitResult>(), false);
    }
}

registerBlueprintMixin(BP_CubeBlueprint, BP_CubeMixin);
