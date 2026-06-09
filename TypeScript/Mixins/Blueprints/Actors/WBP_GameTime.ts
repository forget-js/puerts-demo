/**
 * [模块说明] WBP_Test: 显示游戏运行秒数并控制 BP_Test 运动.
 * DONE  1. SetGameSecond 更新文本控件
 * DONE  2. 点击按钮暂停/恢复 BP_Test 运动
 */
import * as UE from 'ue';
import {
    BP_ConeActorBlueprint,
    WBP_GameTimeBlueprint,
    loadBlueprintClass,
    registerBlueprintMixin,
    type BlueprintInstance,
} from '../../../Blueprints';
import { GF, GE } from '../../../Global';
import {
    clearMixinRuntimeState,
    getMixinRuntimeState,
    type MixinRuntimeState,
} from '../../../Runtime';


// ===========================================================================
//                                   配置常量
// ===========================================================================

const GAME_TIME_TEXT_PREFIX = '游戏时间';
const BP_TEST_CLASS = loadBlueprintClass(BP_ConeActorBlueprint);


// ===========================================================================
//                                   运行时状态
// ===========================================================================

// 需要自定义运行时状态时, 扩展 MixinRuntimeState 并在此声明 interface:
//
interface MovementControlActor extends BlueprintInstance<typeof BP_ConeActorBlueprint> {
    ToggleMovementPaused(): boolean;
}

interface WBP_TestRuntimeState extends MixinRuntimeState {
    isToggleButtonBound?: boolean;
}


// ===========================================================================
//                            Blueprint Mixin 绑定
// ===========================================================================

interface WBP_GameTimeMixin extends BlueprintInstance<typeof WBP_GameTimeBlueprint> { }
class WBP_GameTimeMixin implements WBP_GameTimeMixin {

    // ===========================================================================
    //                                生命周期函数
    // ===========================================================================

    Construct(): void {
        this.bindToggleButton();
    }

    Destruct(): void {
        clearMixinRuntimeState(this);
    }


    // ===========================================================================
    //                                  对外方法
    // ===========================================================================

    SetGameSecond(GameSecond: number): void {
        this.bp_GameSecond.SetText(`${GAME_TIME_TEXT_PREFIX}: ${Math.floor(GameSecond)} 秒`);
    }


    // ===========================================================================
    //                                状态访问方法
    // ===========================================================================

    private getRuntimeState(): WBP_TestRuntimeState {
        return getMixinRuntimeState(this) as WBP_TestRuntimeState;
    }


    // ===========================================================================
    //                                  私有方法
    // ===========================================================================

    private bindToggleButton(): void {
        const state = this.getRuntimeState();
        if (state.isToggleButtonBound) {
            return;
        }

        if (!this.bp_Btn) {
            GF.Log(this, '[WBP_Test] bp_Btn missing', GE.LogLevel.Warning);
            return;
        }

        state.delegates.bind(this.bp_Btn.OnClicked, this, this.onToggleButtonClicked);
        state.isToggleButtonBound = true;
    }

    private onToggleButtonClicked(): void {
        const testActor = UE.GameplayStatics.GetActorOfClass(this, BP_TEST_CLASS) as MovementControlActor | undefined;

        if (!testActor || typeof testActor.ToggleMovementPaused !== 'function') {
            GF.Log(this, '[WBP_Test] BP_Test actor missing or not initialized', GE.LogLevel.Warning);
            return;
        }

        testActor.ToggleMovementPaused();
    }
}


registerBlueprintMixin(WBP_GameTimeBlueprint, WBP_GameTimeMixin);
