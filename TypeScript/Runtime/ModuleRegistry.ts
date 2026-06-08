/**
 * 显式业务模块注册与分阶段生命周期调度.
 *
 * 在 Game/register.ts 中 register 各 Feature 模块, 由 Bootstrap/startGame 按
 * init -> start (正序) 与 stop -> dispose (逆序) 驱动; 各阶段经 ErrorBoundary 包裹.
 */

import { runSafely } from './ErrorBoundary';

/** 可注册的游戏业务模块; 生命周期钩子均为可选. */
export interface GameModule {
    readonly name: string;
    init?(): void;
    start?(): void;
    stop?(): void;
    dispose?(): void;
}

type ModuleStage = 'init' | 'start' | 'stop' | 'dispose';

export class ModuleRegistry {
    /** 注册顺序即 init/start 执行顺序, 亦决定 stop/dispose 的逆序. */
    private readonly modules: GameModule[] = [];
    private readonly moduleNames = new Set<string>();

    /** 注册模块; 同名重复注册会抛错. */
    register(module: GameModule): void {
        if (this.moduleNames.has(module.name)) {
            throw new Error(`Duplicate game module: ${module.name}`);
        }

        this.moduleNames.add(module.name);
        this.modules.push(module);
    }

    initAll(): void {
        this.runStage('init');
    }

    startAll(): void {
        this.runStage('start');
    }

    /** 按注册逆序停止, 后注册的模块先 stop. */
    stopAll(): void {
        this.runStageReverse('stop');
    }

    /** 按注册逆序销毁, 与 stop 对称, 便于释放依赖顺序. */
    disposeAll(): void {
        this.runStageReverse('dispose');
    }

    getRegisteredModuleNames(): string[] {
        return this.modules.map((module) => module.name);
    }

    private runStage(stage: ModuleStage): void {
        for (const module of this.modules) {
            this.runModuleStage(module, stage);
        }
    }

    private runStageReverse(stage: ModuleStage): void {
        for (let index = this.modules.length - 1; index >= 0; --index) {
            this.runModuleStage(this.modules[index], stage);
        }
    }

    private runModuleStage(module: GameModule, stage: ModuleStage): void {
        const handler = module[stage];
        if (typeof handler !== 'function') {
            return;
        }

        runSafely(`GameModule.${module.name}.${stage}`, () => handler.call(module));
    }
}
