/**
 * Auto-generated Blueprint Catalog.
 *
 * Do not edit directly; generated from TypeScript/Mixins/_generated/blueprint-manifest.json.
 */
import * as UE from 'ue';

export type BlueprintSymbol =
    | 'BP_ActorBlueprint'
    | 'BP_ConeActorBlueprint'
    | 'BP_CubeBlueprint'
    | 'BP_UMGManagerBlueprint'
    | 'WBP_GameTimeBlueprint';

export interface BlueprintDescriptor<TSymbol extends BlueprintSymbol = BlueprintSymbol> {
    readonly symbol: TSymbol;
    readonly guid: string;
    readonly path: string;
}

export const BP_ActorBlueprint = {
    symbol: 'BP_ActorBlueprint',
    guid: 'legacy:/Game/Blueprints/Actors/BP_Actor',
    path: '/Game/Blueprints/Actors/BP_Actor.BP_Actor_C',
} as const;

export const BP_ConeActorBlueprint = {
    symbol: 'BP_ConeActorBlueprint',
    guid: '472F7E28-44BB-212F-ADA4-E78C11DF0C5C',
    path: '/Game/Blueprints/Actors/BP_ConeActor.BP_ConeActor_C',
} as const;

export const BP_CubeBlueprint = {
    symbol: 'BP_CubeBlueprint',
    guid: 'legacy:/Game/Blueprints/BP_Cube',
    path: '/Game/Blueprints/BP_Cube.BP_Cube_C',
} as const;

export const BP_UMGManagerBlueprint = {
    symbol: 'BP_UMGManagerBlueprint',
    guid: 'legacy:/Game/Blueprints/Actors/BP_UMGManager',
    path: '/Game/Blueprints/Actors/BP_UMGManager.BP_UMGManager_C',
} as const;

export const WBP_GameTimeBlueprint = {
    symbol: 'WBP_GameTimeBlueprint',
    guid: 'D567E919-4DC0-3758-15AA-08BA066B2714',
    path: '/Game/Blueprints/Actors/WBP_GameTime.WBP_GameTime_C',
} as const;

export const BlueprintCatalog = {
    BP_ActorBlueprint,
    BP_ConeActorBlueprint,
    BP_CubeBlueprint,
    BP_UMGManagerBlueprint,
    WBP_GameTimeBlueprint,
} as const;

export type BlueprintInstanceMap = {
    BP_ActorBlueprint: UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C;
    BP_ConeActorBlueprint: UE.Game.Blueprints.Actors.BP_ConeActor.BP_ConeActor_C;
    BP_CubeBlueprint: UE.Game.Blueprints.BP_Cube.BP_Cube_C;
    BP_UMGManagerBlueprint: UE.Game.Blueprints.Actors.BP_UMGManager.BP_UMGManager_C;
    WBP_GameTimeBlueprint: UE.Game.Blueprints.Actors.WBP_GameTime.WBP_GameTime_C;
};

export type BlueprintClassMap = {
    BP_ActorBlueprint: typeof UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C;
    BP_ConeActorBlueprint: typeof UE.Game.Blueprints.Actors.BP_ConeActor.BP_ConeActor_C;
    BP_CubeBlueprint: typeof UE.Game.Blueprints.BP_Cube.BP_Cube_C;
    BP_UMGManagerBlueprint: typeof UE.Game.Blueprints.Actors.BP_UMGManager.BP_UMGManager_C;
    WBP_GameTimeBlueprint: typeof UE.Game.Blueprints.Actors.WBP_GameTime.WBP_GameTime_C;
};

export type BlueprintInstance<TDescriptor extends BlueprintDescriptor> = BlueprintInstanceMap[TDescriptor['symbol']];
export type BlueprintClass<TDescriptor extends BlueprintDescriptor> = BlueprintClassMap[TDescriptor['symbol']];
