import * as UE from 'ue';
import { $ref, blueprint } from 'puerts';

const uclass = UE.Class.Load("/Game/Blueprints/BP_NewCube.BP_NewCube_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.BP_NewCube.BP_NewCube_C>(uclass);

interface BP_NewCubeMixin extends UE.Game.Blueprints.BP_NewCube.BP_NewCube_C { }
class BP_NewCubeMixin implements BP_NewCubeMixin {
    ReceiveBeginPlay(): void {
        console.log("========== ts log")
    }

    ReceiveTick(DeltaSeconds: number): void {
        this.K2_AddActorLocalRotation(new UE.Rotator(0, 0, DeltaSeconds * 10), false, $ref<UE.HitResult>(), false)
    }
}

blueprint.mixin(jsClass, BP_NewCubeMixin);
