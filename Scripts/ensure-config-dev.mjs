/**
 * 确保本地 config.dev.ts 存在.
 *
 * 若 TypeScript/Config/Env/config.dev.ts 缺失, 从 config.dev.example.ts 复制生成.
 * 已存在的文件不会被覆盖, 便于保留本机调试配置.
 *
 * 由 postinstall 与 build/check/start 前置调用.
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const configDir = path.resolve(projectRoot, 'TypeScript/Config/Env');
const targetFile = path.join(configDir, 'config.dev.ts');
const exampleFile = path.join(configDir, 'config.dev.example.ts');

if (!fs.existsSync(exampleFile)) {
    console.error(`[ensure-config-dev] example missing: ${path.relative(projectRoot, exampleFile)}`);
    process.exit(1);
}

if (fs.existsSync(targetFile)) {
    const content = fs.readFileSync(targetFile, 'utf8');
    if (!content.includes('devHttp')) {
        console.warn(
            '[ensure-config-dev] config.dev.ts missing features.devHttp; Map_Test HTTP demo is disabled by default.',
            'Add features.devHttp.enabled: true (see config.dev.example.ts).'
        );
    }
    console.log(`[ensure-config-dev] ok (exists) ${path.relative(projectRoot, targetFile)}`);
    process.exit(0);
}

fs.copyFileSync(exampleFile, targetFile);
console.log(
    `[ensure-config-dev] created ${path.relative(projectRoot, targetFile)} from config.dev.example.ts`
);
