/**
 * 脚本构建版本信息 (由 Scripts/write-build-info.mjs 生成, 勿手改).
 *
 * 在 Bootstrap 启动日志与 RuntimeDiagnostics 中引用, 用于区分本地/CI 编译产物.
 */

export interface ScriptBuildInfo {
    version: string;
    builtAt: string;
    commit: string;
}

/** 当前编译产物的版本快照; npm 构建流程会覆写此常量. */
export const ScriptBuildInfo: ScriptBuildInfo = {
    version: '1.0.0',
    builtAt: '2026-06-05T10:28:45.000Z',
    commit: '49a1c90',
};
