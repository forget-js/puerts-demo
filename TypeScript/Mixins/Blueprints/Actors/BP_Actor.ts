import * as UE from 'ue';
import { blueprint } from 'puerts';

const uclass = UE.Class.Load("/Game/Blueprints/Actors/BP_Actor.BP_Actor_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C>(uclass);

interface BP_ActorMixin extends UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C { }
class BP_ActorMixin implements BP_ActorMixin {
    ReceiveBeginPlay(): void {
        // 只要override，蓝图侧的实现就会被覆盖，哪怕这里没有逻辑
    }

    // ReceiveTick(DeltaSeconds: number): void {
    // }

    // ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
    // }
}

blueprint.mixin(jsClass, BP_ActorMixin);
