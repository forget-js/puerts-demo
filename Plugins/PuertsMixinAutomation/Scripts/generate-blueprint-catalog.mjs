/**
 * 生成 Blueprint Catalog，并在编辑器重命名蓝图时同步 Manifest / TS 引用。
 *
 * 默认模式只根据现有 Manifest 重写 Catalog；`--sync-blueprint` 模式会新增/更新
 * 单个蓝图条目，并可通过 `--rename-scripts` 同步一对一 mixin 文件名和引用符号。
 *
 * 用法:
 *   node generate-blueprint-catalog.mjs --project=<项目根>
 *   node generate-blueprint-catalog.mjs --project=<项目根> --sync-blueprint --blueprint=/Game/... --old-blueprint=/Game/... --guid=...
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadManifest,
  makeBlueprintEntry,
  makeRelativeImportPath,
  normalizeAssetRoot,
  normalizeProjectRelativePath,
  saveCatalog,
  saveManifest,
  toProjectPath,
  upsertManifestEntry,
  walkTypeScriptFiles,
} from './blueprint-manifest-utils.mjs';

const args = process.argv.slice(2);

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

/** 只替换完整标识符，避免误伤字符串片段或其他变量名。 */
function replaceWord(source, from, to) {
  if (!from || from === to) {
    return source;
  }
  return source.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
}

/** 文件被移动后，修正常见根目录 import，避免相对路径失效。 */
function updateKnownRootImports(source, file, projectRoot) {
  const blueprintsImport = makeRelativeImportPath(file, path.resolve(projectRoot, 'TypeScript/Blueprints'));
  const runtimeImport = makeRelativeImportPath(file, path.resolve(projectRoot, 'TypeScript/Runtime'));
  const globalImport = makeRelativeImportPath(file, path.resolve(projectRoot, 'TypeScript/Global'));

  return source
    .replace(/from\s+['"][./]+Blueprints['"]/g, `from '${blueprintsImport}'`)
    .replace(/from\s+['"][./]+Runtime['"]/g, `from '${runtimeImport}'`)
    .replace(/from\s+['"][./]+Global['"]/g, `from '${globalImport}'`);
}

/** 重命名蓝图时，把旧 Catalog 符号和 mixin 类名同步改为新名称。 */
function rewriteTypeScriptReferences({ projectRoot, previous, entry, catalogFile }) {
  if (!previous) {
    return;
  }

  const typeScriptRoot = path.resolve(projectRoot, 'TypeScript');
  const catalogAbsolute = path.resolve(catalogFile);
  for (const file of walkTypeScriptFiles(typeScriptRoot)) {
    if (path.resolve(file) === catalogAbsolute) {
      continue;
    }

    let source = fs.readFileSync(file, 'utf8');
    const original = source;
    source = replaceWord(source, previous.catalogSymbol, entry.catalogSymbol);
    source = replaceWord(source, previous.mixinClassName, entry.mixinClassName);

    if (source !== original) {
      source = updateKnownRootImports(source, file, projectRoot);
      fs.writeFileSync(file, source, 'utf8');
    }
  }
}

/** 按 Manifest 映射移动一对一 mixin 文件；目标存在时中止，避免覆盖手写代码。 */
function moveMixinFile({ projectRoot, previous, entry }) {
  if (!previous || previous.mixinFile === entry.mixinFile) {
    return;
  }

  const oldFile = toProjectPath(projectRoot, previous.mixinFile);
  const newFile = toProjectPath(projectRoot, entry.mixinFile);
  if (!fs.existsSync(oldFile)) {
    return;
  }
  if (fs.existsSync(newFile)) {
    throw new Error(`Target mixin already exists: ${entry.mixinFile}`);
  }

  fs.mkdirSync(path.dirname(newFile), { recursive: true });
  fs.renameSync(oldFile, newFile);
}

const projectRoot = path.resolve(readArg('project', process.cwd()));
const blueprintRoot = normalizeAssetRoot(readArg('blueprint-root', '/Game/Blueprints'));
const mixinRoot = normalizeProjectRelativePath(readArg('mixin-root', 'TypeScript/Mixins/Blueprints'));
const manifestFile = toProjectPath(projectRoot, readArg('manifest', 'TypeScript/Mixins/_generated/blueprint-manifest.json'));
const catalogFile = toProjectPath(projectRoot, readArg('catalog', 'TypeScript/Blueprints/_generated/BlueprintCatalog.ts'));

const manifest = loadManifest(manifestFile);

if (hasFlag('sync-blueprint')) {
  const blueprintPath = readArg('blueprint');
  if (!blueprintPath) {
    console.error('[PuertsMixinAutomation] Missing required argument: --blueprint=/Game/...');
    process.exit(1);
  }

  const oldBlueprintPath = readArg('old-blueprint');
  const guid = readArg('guid');
  const newEntry = makeBlueprintEntry({
    packageName: blueprintPath,
    rootPath: blueprintRoot,
    mixinRoot,
    guid,
  });
  const { entry, previous } = upsertManifestEntry(manifest, newEntry, {
    oldPackageName: oldBlueprintPath,
  });

  if (hasFlag('rename-scripts')) {
    try {
      moveMixinFile({ projectRoot, previous, entry });
      rewriteTypeScriptReferences({ projectRoot, previous, entry, catalogFile });
    } catch (error) {
      console.error(`[PuertsMixinAutomation] ${error.message}`);
      process.exit(1);
    }
  }
}

saveManifest(manifestFile, manifest);
saveCatalog(catalogFile, manifest);
