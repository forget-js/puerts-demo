/**
 * [模块说明] BP_ConeActor: 按蓝图半径 bp_radius 在水平面做圆周运动 (需 Tick).
 * DONE  1. BeginPlay 记录圆心与起始时间
 * DONE  2. ReceiveTick 使用 DeltaSeconds 按角速度更新位置
 * DONE  3. ReceiveEndPlay 清理运行时状态
 * DONE  4. 支持暂停/恢复圆周运动
 *
 * Tick 说明: 该示例需要每帧驱动 Actor 位移；实例较多时应改为 Timer、Timeline 或蓝图表现层方案。
 */
import * as UE from 'ue';
import {
    BP_ConeActorBlueprint,
    registerBlueprintMixin,
    type BlueprintInstance,
} from '../../../Blueprints';
import { GF } from '../../../Global';
import {
    clearMixinRuntimeState,
    getMixinRuntimeState,
    type MixinRuntimeState,
} from '../../../Runtime';



// ===========================================================================
//                                   配置常量
// ===========================================================================

/** 绕圆心旋转的角速度 (弧度/秒). */
const ORBIT_ANGULAR_SPEED = Math.PI / 2;



// ===========================================================================
//                                   运行时状态
// ===========================================================================

interface OrbitRuntimeState {
    center: UE.Vector;
    angle: number;
}

interface BP_ConeActorRuntimeState extends MixinRuntimeState {
    orbit?: OrbitRuntimeState;
    isMovementPaused?: boolean;
}



// ===========================================================================
//                           Blueprint Mixin 绑定
// ===========================================================================

interface BP_ConeActorMixin extends BlueprintInstance<typeof BP_ConeActorBlueprint> { }
class BP_ConeActorMixin implements BP_ConeActorMixin {

    // ===========================================================================
    //                                生命周期函数
    // ===========================================================================

    ReceiveBeginPlay(): void {
        const state = this.getRuntimeState();
        state.orbit = {
            center: GF.GetActorLocation(this),
            angle: 0,
        };
        state.isMovementPaused = false;
    }

    ReceiveTick(DeltaSeconds: number): void {
        if (this.IsMovementPaused()) {
            return;
        }

        this.updateOrbitLocation(DeltaSeconds);
    }

    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
        clearMixinRuntimeState(this);
    }



    // ===========================================================================
    //                                状态访问方法
    // ===========================================================================

    IsMovementPaused(): boolean {
        return this.getRuntimeState().isMovementPaused ?? false;
    }

    SetMovementPaused(isPaused: boolean): void {
        this.getRuntimeState().isMovementPaused = isPaused;
        GF.Log(this, `movement ${isPaused ? 'paused' : 'resumed'}`, {
            context: { paused: isPaused },
        });
    }

    ToggleMovementPaused(): boolean {
        const nextPaused = !this.IsMovementPaused();
        this.SetMovementPaused(nextPaused);
        return nextPaused;
    }

    private getRuntimeState(): BP_ConeActorRuntimeState {
        return getMixinRuntimeState(this) as BP_ConeActorRuntimeState;
    }



    // ===========================================================================
    //                                  私有方法
    // ===========================================================================

    private updateOrbitLocation(deltaSeconds: number): void {
        const orbit = this.getRuntimeState().orbit;
        if (!orbit) {
            GF.Warn(this, 'orbit missing', {
                context: { radius: this.bp_radius },
            });
            return;
        }

        const radius = Number(this.bp_radius);
        if (!Number.isFinite(radius) || radius <= 0) {
            GF.Warn(this, 'invalid radius', {
                context: { radius: this.bp_radius },
            });
            return;
        }

        orbit.angle += ORBIT_ANGULAR_SPEED * deltaSeconds;
        const center = orbit.center;

        const newLocation = new UE.Vector(
            center.X + radius * Math.cos(orbit.angle),
            center.Y + radius * Math.sin(orbit.angle),
            center.Z
        );

        GF.SetActorLocation(this, newLocation);
    }
}



registerBlueprintMixin(BP_ConeActorBlueprint, BP_ConeActorMixin);
