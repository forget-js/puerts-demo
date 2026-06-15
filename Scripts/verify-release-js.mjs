/**
 * 校验 Content/JavaScript 是否满足 Shipping 发布要求.
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const contentRoot = path.resolve(projectRoot, 'Content/JavaScript');
const errors = [];

function toProjectRelative(file) {
    return path.relative(projectRoot, file).replace(/\\/g, '/');
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

function readTextIfPossible(file) {
    if (!/\.(js|json|txt)$/i.test(file)) {
        return undefined;
    }

    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}

function assertFileExists(file, message) {
    if (!fs.existsSync(file)) {
        errors.push(`${message}: ${toProjectRelative(file)}`);
    }
}

if (!fs.existsSync(contentRoot)) {
    console.error(`[verify-release-js] missing ${toProjectRelative(contentRoot)}. Run npm run build:shipping first.`);
    process.exit(1);
}

const forbiddenContent = [
    {
        name: 'apifox mock endpoint',
        pattern: /apifoxmock|7256272-6983470-default/i,
    },
    {
        name: 'development config import',
        pattern: /require\(["']\.\/config\.dev["']\)|from ["']\.\/config\.dev["']/,
    },
    {
        name: 'development active profile',
        pattern: /activeConfigProfile\s*=\s*["']Development["']/,
    },
];

walk(contentRoot, (file) => {
    if (file.endsWith('.map')) {
        errors.push(`source map must not be staged: ${toProjectRelative(file)}`);
        return;
    }

    const relative = toProjectRelative(file);
    const baseName = path.basename(file);
    if (/^config\.dev(\.example)?\.js$/i.test(baseName)) {
        errors.push(`development config artifact must not be staged: ${relative}`);
    }
    if (relative.includes('/PuertsEditor/')) {
        errors.push(`PuertsEditor artifact must not be staged: ${relative}`);
    }
    if (/\/wasm\/(?:.*_Editor|test.*)\.wasm$/i.test(relative)) {
        errors.push(`editor/test wasm must not be staged: ${relative}`);
    }

    const content = readTextIfPossible(file);
    if (!content) {
        return;
    }

    for (const rule of forbiddenContent) {
        if (rule.pattern.test(content)) {
            errors.push(`${rule.name} found in ${relative}`);
        }
    }
});

const activeConfig = path.join(contentRoot, 'Config/Env/config.active.js');
const buildInfo = path.join(contentRoot, 'Runtime/BuildInfo.js');
assertFileExists(activeConfig, 'active config artifact missing');
assertFileExists(buildInfo, 'build info artifact missing');

if (fs.existsSync(activeConfig)) {
    const source = fs.readFileSync(activeConfig, 'utf8');
    if (!/activeConfigProfile\s*=\s*["']Shipping["']/.test(source)) {
        errors.push(`${toProjectRelative(activeConfig)} does not point to Shipping profile`);
    }
    if (/config\.dev/.test(source)) {
        errors.push(`${toProjectRelative(activeConfig)} must not import config.dev`);
    }
}

if (fs.existsSync(buildInfo)) {
    const source = fs.readFileSync(buildInfo, 'utf8');
    if (/commit:\s*["']unknown["']/.test(source)) {
        errors.push(`${toProjectRelative(buildInfo)} has unknown commit`);
    }
}

if (errors.length > 0) {
    console.error('[verify-release-js] failed:');
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log('[verify-release-js] ok');
