/** Runtime 对外统一导出; Mixin / Bootstrap / Game 应从此入口引用基础设施. */
export { ScriptBuildInfo, type ScriptBuildInfo as ScriptBuildInfoShape } from './BuildInfo';
export { createRuntimeDiagnostics, type RuntimeDiagnostics } from './Diagnostics';
export { DelegateBag, type RemovableDelegate } from './DelegateBag';
export { installGlobalErrorHandlers, reportError, runSafely } from './ErrorBoundary';
export * from './Http';
export {
    clearAllMixinRuntimeStates,
    clearMixinRuntimeState,
    getMixinRuntimeState,
    getMixinRuntimeStateCount,
    type MixinRuntimeState,
} from './MixinState';
export { bindScriptLifecycle, type ScriptLifecycleBindings } from './ScriptLifecycle';
export { type GameModule, ModuleRegistry } from './ModuleRegistry';
export { TimerBag } from './TimerBag';
