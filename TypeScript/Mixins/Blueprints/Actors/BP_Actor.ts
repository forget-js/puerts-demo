/**
 * [示例] BP_Actor: 定时器、委托绑定与蓝图函数调用演示.
 * DONE  1. ReceiveBeginPlay 注册 TimerBag / DelegateBag
 * DONE  2. Overlap 回调与 GF.Log
 * DONE  3. ReceiveEndPlay 清理运行时状态
 */
import * as UE from 'ue';
import { blueprint } from 'puerts';
import { GF } from '../../../Global';
import { clearMixinRuntimeState, getMixinRuntimeState } from '../../../Runtime';

const uclass = UE.Class.Load("/Game/Blueprints/Actors/BP_Actor.BP_Actor_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C>(uclass);

interface BP_ActorMixin extends UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C { }
class BP_ActorMixin implements BP_ActorMixin {

    // 只要override，蓝图侧的实现就会被覆盖，哪怕这里没有逻辑
    ReceiveBeginPlay(): void {

        const state = getMixinRuntimeState(this);

        // 一次性：5 秒后执行一次（类似蓝图 Delay）
        state.timers.setTimeout(this.onBeginPlayDelayedLog.bind(this), 5000);

        // 循环：每隔 5 秒执行一次（类似蓝图 Set Timer，Time=5，Looping=true）
        state.timers.setInterval(this.onPeriodicTick.bind(this), 5000);

        // 运行时绑定组件重叠（类似 C++ 里 Sphere1->OnComponentBeginOverlap.AddDynamic）
        state.delegates.bind(this.Sphere1.OnComponentBeginOverlap, this, this.onSphereBeginOverlap);
        state.delegates.bind(this.Sphere1.OnComponentEndOverlap, this, this.onSphereEndOverlap);


        // 调用蓝图中的函数
        this.BP_Print("来自ts的文本");
    }


    /** 必须清理定时器与委托, 避免 EndPlay 后仍触发回调. */
    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
        clearMixinRuntimeState(this);
    }


    private onSphereBeginOverlap(
        OverlappedComponent: UE.PrimitiveComponent | null,
        OtherActor: UE.Actor | null,
        OtherComp: UE.PrimitiveComponent | null,
        OtherBodyIndex: number,
        bFromSweep: boolean,
        SweepResult: UE.HitResult
    ): void {
        if (OtherActor) {
            GF.Log(this, `触碰物体: ${OtherActor.GetName()}`);
        }
    }
    private onSphereEndOverlap(
        OverlappedComponent: UE.PrimitiveComponent | null,
        OtherActor: UE.Actor | null,
        OtherComp: UE.PrimitiveComponent | null,
        OtherBodyIndex: number
    ): void {
        if (OtherActor) {
            GF.Log(`离开物体: ${OtherActor.GetName()}`);
        }
    }


    private onBeginPlayDelayedLog(): void {
        GF.Log(this, 'BeginPlay 延迟 5 秒后的日志');
    }

    private onPeriodicTick(): void {
        GF.Log(this, '每隔 5 秒定时调用');
    }


}

blueprint.mixin(jsClass, BP_ActorMixin);
