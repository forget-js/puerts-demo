/**
 * [模块说明] BP_Cube: 本地旋转演示 (需 Tick).
 * DONE  1. ReceiveTick 驱动绕 Z 轴旋转 (蓝图 Event Graph 需启用 Tick)
 * DONE  2. ReceiveBeginPlay 调用测试域 HTTP (Mock)
 */
import * as UE from 'ue';
import { $ref } from 'puerts';
import {
    BP_CubeBlueprint,
    registerBlueprintMixin,
    type BlueprintInstance,
} from '../../Blueprints';
import { GF } from '../../Global';
import { Api, setupTestMockTransport } from '../../Game/Services';
import { HttpError } from '../../Runtime';



// ===========================================================================
//                           Blueprint Mixin 绑定
// ===========================================================================

interface BP_CubeMixin extends BlueprintInstance<typeof BP_CubeBlueprint> { }
class BP_CubeMixin implements BP_CubeMixin {

    // ===========================================================================
    //                                生命周期函数
    // ===========================================================================

    ReceiveBeginPlay(): void {
        GF.Log(this, 'BP_Cube BeginPlay');
        Api.setTransport(setupTestMockTransport());
        void this.runTestHttpDemo();
    }

    // 演示用途: 每帧按 DeltaSeconds 旋转; 正式业务应避免 Tick, 改用 Timer 或事件驱动.
    ReceiveTick(DeltaSeconds: number): void {
        this.K2_AddActorLocalRotation(new UE.Rotator(0, 0, DeltaSeconds * 10), false, $ref<UE.HitResult>(), false);
    }



    private async runTestHttpDemo(): Promise<void> {
        const options = { owner: this };
        try {
            const ping = await Api.test.ping(options);
            GF.Log(this, 'test.ping', { context: { ...ping }, toScreen: false });
            const echo = await Api.test.echoQuery('Cube', options);
            GF.Log(this, 'test.echoQuery', { context: { ...echo }, toScreen: false });
            const created = await Api.test.createItem({ name: 'MockSword', quantity: 1 }, options);
            GF.Log(this, 'test.createItem', { context: { ...created }, toScreen: false });
            const updated = await Api.test.updateItem(
                created.id,
                { name: 'MockSword+', quantity: 2 },
                options
            );
            GF.Log(this, 'test.updateItem', { context: { ...updated }, toScreen: false });
            const deleted = await Api.test.deleteItem(created.id, options);
            GF.Log(this, 'test.deleteItem', { context: { ...deleted }, toScreen: false });
        } catch (error) {
            const message = error instanceof HttpError
                ? `${error.kind}: ${error.message}`
                : String(error);
            GF.Warn(this, 'test HTTP demo failed', { context: { message }, toScreen: false });
        }
    }

}

registerBlueprintMixin(BP_CubeBlueprint, BP_CubeMixin);
