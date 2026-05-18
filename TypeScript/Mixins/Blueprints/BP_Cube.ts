import * as UE from 'ue';
import { $ref, blueprint } from 'puerts';

const uclass = UE.Class.Load("/Game/Blueprints/BP_Cube.BP_Cube_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.BP_Cube.BP_Cube_C>(uclass);

interface BP_CubeMixin extends UE.Game.Blueprints.BP_Cube.BP_Cube_C { }
class BP_CubeMixin implements BP_CubeMixin {

    ReceiveBeginPlay(): void {
        console.log("=== ts log")
    }

    ReceiveTick(DeltaSeconds: number): void {
        this.K2_AddActorLocalRotation(new UE.Rotator(0, 0, DeltaSeconds * 10), false, $ref<UE.HitResult>(), false)
    }
}

blueprint.mixin(jsClass, BP_CubeMixin);
