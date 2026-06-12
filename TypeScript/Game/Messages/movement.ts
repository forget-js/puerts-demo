/**
 * 运动控制相关全局消息定义.
 */

/** 请求切换运动控制器的暂停状态. */
export const MOVEMENT_TOGGLE_REQUEST = {
    name: 'MOVEMENT_TOGGLE_REQUEST',
    params: {
        /** 多实例时指定控制器 id; Map_Test 可省略. */
        controllerId: { index: 1, type: 'string', required: false },
    },
} as const;

export type MovementToggleRequestPayload = {
    readonly controllerId?: string;
};
