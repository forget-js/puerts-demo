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
import { BP_ConeActorBlueprint, registerBlueprintMixin, type BlueprintInstance } from '../../../Blueprints';
import { GF, GE } from '../../../Global';
import { Api } from '../../../Game/Services';
import {
    clearMixinRuntimeState,
    getMixinRuntimeState,
    HttpError,
    UnrealHttpTransport,
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

interface BP_ConeActorMixin extends BlueprintInstance<typeof BP_ConeActorBlueprint> {}
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
        void this.runTestUserHttpDemo();
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

    // ===========================================================================
    //                                  测试域 HTTP 演示
    // ===========================================================================

    private async runTestUserHttpDemo(): Promise<void> {
        // BP_Cube 等演示会把 Api 切到 MockHttpTransport; 联调 Apifox 前恢复真实 Transport.
        Api.setTransport(new UnrealHttpTransport());

        const options = { owner: this };
        const demoUser = {
            username: 'ConeDemoUser',
            firstName: 'Cone',
            lastName: 'Actor',
            email: 'cone.demo@example.com',
            password: 'demo-password',
            phone: '13800000000',
            userStatus: 0,
        };

        try {
            await Api.testUser.createUser(demoUser, options);
            GF.LogPrettyJson(this, 'testUser.createUser', { username: demoUser.username });

            const user = await Api.testUser.getUserByName(demoUser.username, options);
            GF.LogPrettyJson(this, 'testUser.getUserByName', user);

            await Api.testUser.updateUser(demoUser.username, { ...user, firstName: 'ConeUpdated' }, options);
            GF.LogPrettyJson(this, 'testUser.updateUser', { username: demoUser.username });

            await Api.testUser.deleteUser(demoUser.username, options);
            GF.LogPrettyJson(this, 'testUser.deleteUser', { username: demoUser.username });
        } catch (error) {
            const message =
                error instanceof HttpError
                    ? `${error.kind}: ${error.message}${error.url ? ` (${error.method ?? '?'} ${error.url})` : ''}`
                    : String(error);
            GF.LogPrettyJson(this, 'testUser HTTP demo failed', { message }, { level: GE.LogLevel.Warning });
        }
    }
}

registerBlueprintMixin(BP_ConeActorBlueprint, BP_ConeActorMixin);
