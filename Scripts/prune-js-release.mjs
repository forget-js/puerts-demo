/**
 * 裁剪 Shipping / QA 发布不应进入包体的 Content/JavaScript 文件.
 *
 * 本脚本只删除由 TypeScript 构建或 Puerts 示例内容派生的开发产物, 不清空整棵
 * Content/JavaScript, 避免误删 Puerts 运行时必需文件.
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const contentRoot = path.resolve(projectRoot, 'Content/JavaScript');

const removed = [];

function toProjectRelative(file) {
    return path.relative(projectRoot, file).replace(/\\/g, '/');
}

function removePath(target) {
    if (!fs.existsSync(target)) {
        return;
    }

    fs.rmSync(target, { recursive: true, force: true });
    removed.push(toProjectRelative(target));
}

function walk(dir, visitor) {
    if (!fs.existsSync(dir)) {
        return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, visitor);
            continue;
        }

        visitor(fullPath);
    }
}

if (!fs.existsSync(contentRoot)) {
    console.error(`[prune-js-release] missing ${toProjectRelative(contentRoot)}. Run tsc before pruning.`);
    process.exit(1);
}

removePath(path.join(contentRoot, 'PuertsEditor'));

const configEnvRoot = path.join(contentRoot, 'Config/Env');
for (const name of ['config.dev', 'config.dev.example']) {
    removePath(path.join(configEnvRoot, `${name}.js`));
    removePath(path.join(configEnvRoot, `${name}.js.map`));
}

const wasmRoot = path.join(contentRoot, 'wasm');
walk(wasmRoot, (file) => {
    const name = path.basename(file);
    if (name.endsWith('_Editor.wasm') || /^test.*\.wasm$/i.test(name)) {
        removePath(file);
    }
});

walk(contentRoot, (file) => {
    if (file.endsWith('.map')) {
        removePath(file);
    }
});

if (removed.length === 0) {
    console.log('[prune-js-release] no release-only files removed');
} else {
    console.log(`[prune-js-release] removed ${removed.length} file(s)/folder(s):`);
    for (const file of removed) {
        console.log(`- ${file}`);
    }
}
