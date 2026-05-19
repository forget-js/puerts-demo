import * as UE from 'ue';
import { blueprint } from 'puerts';

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

        // 写法二：运行时绑定组件重叠（类似 C++ 里 Sphere1->OnComponentBeginOverlap.AddDynamic）
        // 若蓝图里仍保留 Sphere1 的 OnComponentBeginOverlap 节点，会与下方 BndEvt__... 同时触发
        this.Sphere1.OnComponentBeginOverlap.Add(this.onSphereBeginOverlap.bind(this));
        this.Sphere1.OnComponentEndOverlap.Add(this.onSphereEndOverlap.bind(this));
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
            console.log(`[Add绑定] 触碰物体: ${OtherActor.GetName()}`);
        }
    }
    private onSphereEndOverlap(
        OverlappedComponent: UE.PrimitiveComponent | null,
        OtherActor: UE.Actor | null,
        OtherComp: UE.PrimitiveComponent | null,
        OtherBodyIndex: number
    ): void {
        if (OtherActor) {
            console.log(`[Add绑定] 离开物体: ${OtherActor.GetName()}`);
        }
    }


    ReceiveTick(DeltaSeconds: number): void {
        // 如果需要tick生效，蓝图侧需要随便连个节点
    }

    private onBeginPlayDelayedLog(): void {
        console.log("BeginPlay 延迟 5 秒后的日志");
    }

    private onPeriodicTick(): void {
        console.log("每隔 5 秒定时调用");
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

    // 【不推荐的写法】方法名须与 ue_bp.d.ts 一致；蓝图增删组件事件后索引会变（当前为 _2 / _3）
    BndEvt__BP_Actor_Sphere1_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(
        OverlappedComponent: UE.PrimitiveComponent | null,
        OtherActor: UE.Actor | null,
        OtherComp: UE.PrimitiveComponent | null,
        OtherBodyIndex: number,
        bFromSweep: boolean,
        SweepResult: UE.HitResult
    ): void {
        if (OtherActor) {
            console.log(`触碰物体: ${OtherActor.GetName()}`);
        }
    }
    BndEvt__BP_Actor_Sphere1_K2Node_ComponentBoundEvent_3_ComponentEndOverlapSignature__DelegateSignature(
        OverlappedComponent: UE.PrimitiveComponent | null,
        OtherActor: UE.Actor | null,
        OtherComp: UE.PrimitiveComponent | null,
        OtherBodyIndex: number
    ): void {
        if (OtherActor) {
            console.log(`离开物体: ${OtherActor.GetName()}`);
        }
    }
}

blueprint.mixin(jsClass, BP_ActorMixin);
