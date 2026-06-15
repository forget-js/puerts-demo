/**
 * [模块说明] BP_Cube: 本地旋转演示 (需 Tick).
 * DONE  1. ReceiveTick 驱动绕 Z 轴旋转 (蓝图 Event Graph 需启用 Tick)
 * DONE  2. ReceiveBeginPlay 调用 DevHttp Mock 联调 (Config.features.devHttp)
 */
import * as UE from 'ue';
import { $ref } from 'puerts';
import { BP_CubeBlueprint, registerBlueprintMixin, type BlueprintInstance } from '../../Blueprints';
import { DevHttp } from '../../Game/Features/DevHttp';
import { GF } from '../../Global';
import { clearMixinRuntimeState, guardOwnerAsync, runSafelyAsync } from '../../Runtime';

// ===========================================================================
//                           Blueprint Mixin 绑定
// ===========================================================================

interface BP_CubeMixin extends BlueprintInstance<typeof BP_CubeBlueprint> {}
class BP_CubeMixin implements BP_CubeMixin {
    // ===========================================================================
    //                                生命周期函数
    // ===========================================================================

    ReceiveBeginPlay(): void {
        GF.Log(this, 'BP_Cube BeginPlay');
        void runSafelyAsync('BP_Cube.runCubeMockFlow', () =>
            guardOwnerAsync(this, 'BP_Cube.runCubeMockFlow', async () => DevHttp.runCubeMockFlow(this))
        );
    }

    // 演示用途: 每帧按 DeltaSeconds 旋转; 正式业务应避免 Tick, 改用 Timer 或事件驱动.
    ReceiveTick(DeltaSeconds: number): void {
        this.K2_AddActorLocalRotation(new UE.Rotator(0, 0, DeltaSeconds * 10), false, $ref<UE.HitResult>(), false);
    }

    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
        // BeginPlay 中的 DevHttp 请求使用 owner 追踪, EndPlay 时统一取消并释放状态.
        clearMixinRuntimeState(this);
    }
}

registerBlueprintMixin(BP_CubeBlueprint, BP_CubeMixin);
