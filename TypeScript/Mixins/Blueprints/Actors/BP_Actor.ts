import * as UE from 'ue';
import { blueprint } from 'puerts';
import { GF } from '../../../Global';

const uclass = UE.Class.Load("/Game/Blueprints/Actors/BP_Actor.BP_Actor_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C>(uclass);

interface BP_ActorMixin extends UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C { }
class BP_ActorMixin implements BP_ActorMixin {

    /** 一次性延迟（类似蓝图 Delay） */
    private beginPlayDelayTimerId?: number;

    /** 循环定时（类似蓝图 Set Timer，Looping = true） */
    private periodicTimerId?: number;



    ReceiveBeginPlay(): void {
        // 只要override，蓝图侧的实现就会被覆盖，哪怕这里没有逻辑

        // 一次性：5 秒后执行一次（类似蓝图 Delay）
        this.beginPlayDelayTimerId = setTimeout(this.onBeginPlayDelayedLog.bind(this), 5000);

        // 循环：每隔 5 秒执行一次（类似蓝图 Set Timer，Time=5，Looping=true）
        this.periodicTimerId = setInterval(this.onPeriodicTick.bind(this), 5000);

        // 运行时绑定组件重叠（类似 C++ 里 Sphere1->OnComponentBeginOverlap.AddDynamic）
        this.Sphere1.OnComponentBeginOverlap.Add(this.onSphereBeginOverlap.bind(this));
        this.Sphere1.OnComponentEndOverlap.Add(this.onSphereEndOverlap.bind(this));


        // 调用蓝图中的函数
        this.BP_Print("来自ts的文本");
    }


    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
        if (this.beginPlayDelayTimerId !== undefined) {
            clearTimeout(this.beginPlayDelayTimerId);
            this.beginPlayDelayTimerId = undefined;
        }
        if (this.periodicTimerId !== undefined) {
            clearInterval(this.periodicTimerId);
            this.periodicTimerId = undefined;
        }
    }


    ReceiveTick(DeltaSeconds: number): void {
        // 如果需要tick生效，蓝图侧需要随便连个节点
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
