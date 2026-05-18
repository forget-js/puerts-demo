import * as UE from 'ue';
import { blueprint } from 'puerts';

const uclass = UE.Class.Load("/Game/Blueprints/Actors/BP_TestActor.BP_TestActor_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.Actors.BP_TestActor.BP_TestActor_C>(uclass);

interface BP_TestActorMixin extends UE.Game.Blueprints.Actors.BP_TestActor.BP_TestActor_C { }
class BP_TestActorMixin implements BP_TestActorMixin {
    ReceiveBeginPlay(): void {
    }

    ReceiveTick(DeltaSeconds: number): void {
    }
}

blueprint.mixin(jsClass, BP_TestActorMixin);
