/**
 * Vitest 的 ue 模块替身.
 *
 * 真实 UE 类型只在编辑器/游戏运行时存在; Node 单测只需要 import Runtime 代码,
 * 因此这里提供 Logger、ObjectValidity 等测试路径会触达的最小 API.
 */
export class LinearColor {
    constructor(
        readonly R = 0,
        readonly G = 0,
        readonly B = 0,
        readonly A = 1
    ) {}
}

export const KismetSystemLibrary = {
    PrintString(): void {
        // Node 单测环境不需要屏幕输出.
    },
    IsValid(): boolean {
        return true;
    },
};

export class Object {}
export class Actor extends Object {}
