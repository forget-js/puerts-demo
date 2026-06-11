/**
 * [模块说明] BP_UMGManager: 创建并刷新游戏时间 UMG.
 * DONE  1. ReceiveBeginPlay 创建控件并添加到屏幕
 * DONE  2. 定时刷新游戏时间
 * DONE  3. ReceiveEndPlay 清理控件与运行时状态
 */
import * as UE from 'ue';
import {
    BP_UMGManagerBlueprint,
    WBP_GameTimeBlueprint,
    registerBlueprintMixin,
    type BlueprintInstance,
} from '../../../Blueprints';
import { clearMixinRuntimeState, getMixinRuntimeState, type MixinRuntimeState } from '../../../Runtime';

// ===========================================================================
//                                   配置常量
// ===========================================================================

const GAME_TIME_UPDATE_INTERVAL_MS = 1000;
const GAME_TIME_WIDGET_Z_ORDER = 0;

// ===========================================================================
//                                   运行时状态
// ===========================================================================

interface WBP_TestDisplay {
    SetGameSecond(GameSecond: number): void;
}

type GameTimeWidget = BlueprintInstance<typeof WBP_GameTimeBlueprint> & WBP_TestDisplay;

interface BP_UMGManagerRuntimeState extends MixinRuntimeState {
    gameTimeWidget?: GameTimeWidget;
}

// ===========================================================================
//                            Blueprint Mixin 绑定
// ===========================================================================

interface BP_UMGManagerMixin extends BlueprintInstance<typeof BP_UMGManagerBlueprint> {}
class BP_UMGManagerMixin implements BP_UMGManagerMixin {
    // ===========================================================================
    //                                  生命周期函数
    // ===========================================================================

    ReceiveBeginPlay(): void {
        const state = this.getRuntimeState();
        const owningPlayer = UE.GameplayStatics.GetPlayerController(this, 0);
        const widget = UE.WidgetBlueprintLibrary.Create(this, this.bp_widgetClass, owningPlayer) as GameTimeWidget;

        widget.AddToViewport(GAME_TIME_WIDGET_Z_ORDER);
        state.gameTimeWidget = widget;

        this.refreshGameTime();
        state.timers.setInterval(this.refreshGameTime.bind(this), GAME_TIME_UPDATE_INTERVAL_MS);
    }

    /** 必须清理定时器与委托, 避免 EndPlay 后仍触发回调. */
    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
        const state = this.getRuntimeState();
        state.gameTimeWidget?.RemoveFromParent();
        clearMixinRuntimeState(this);
    }

    // ===========================================================================
    //                                  状态访问方法
    // ===========================================================================

    // Puerts Mixin 不保证 TS class 字段初始化; 对象级状态请通过 getMixinRuntimeState(this) 管理.
    private getRuntimeState(): BP_UMGManagerRuntimeState {
        return getMixinRuntimeState(this) as BP_UMGManagerRuntimeState;
    }

    // ===========================================================================
    //                                   私有方法
    // ===========================================================================

    private refreshGameTime(): void {
        const widget = this.getRuntimeState().gameTimeWidget;

        if (!widget) {
            return;
        }

        widget.SetGameSecond(UE.GameplayStatics.GetTimeSeconds(this));
    }
}

registerBlueprintMixin(BP_UMGManagerBlueprint, BP_UMGManagerMixin);
