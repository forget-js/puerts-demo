/**
 * 生成 TypeScript/Runtime/BuildInfo.ts 构建版本快照.
 *
 * 由 npm run gen:build-info 调用, 在 npm run build 前写入版本信息.
 * Bootstrap 启动日志与 RuntimeDiagnostics 会读取 ScriptBuildInfo.
 *
 * 环境变量 (CI 可注入):
 *   GIT_COMMIT         提交哈希, 优先于本地 git rev-parse
 *   SCRIPT_VERSION     版本号, 默认 package.json version
 *   SCRIPT_BUILD_TIME  ISO 构建时间, 默认当前时间
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** 读取短 commit: 环境变量优先, 否则尝试 git, 失败返回 unknown. */
function tryReadGitCommit(projectRoot) {
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT;
  }

  try {
    return childProcess
      .execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim();
  } catch {
    return 'unknown';
  }
}

const projectRoot = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'package.json'), 'utf8'));
const outputFile = path.resolve(projectRoot, 'TypeScript/Runtime/BuildInfo.ts');
const version = process.env.SCRIPT_VERSION ?? packageJson.version ?? 'dev';
const builtAt = process.env.SCRIPT_BUILD_TIME ?? new Date().toISOString();
const commit = tryReadGitCommit(projectRoot);

// 覆写 BuildInfo.ts; 该文件带「勿手改」说明, 以本脚本产出为准.
const source = `export interface ScriptBuildInfo {
    version: string;
    builtAt: string;
    commit: string;
}

export const ScriptBuildInfo: ScriptBuildInfo = {
    version: '${version}',
    builtAt: '${builtAt}',
    commit: '${commit}',
};
`;

fs.writeFileSync(outputFile, source, 'utf8');
console.log(`[write-build-info] ${path.relative(projectRoot, outputFile)} ${version} ${commit}`);
