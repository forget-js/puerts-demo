/**
 * 为单个 Blueprint 生成 Puerts mixin TypeScript 模板。
 *
 * 由编辑器模块通过 Node 调用：先维护 Manifest / BlueprintCatalog，
 * 再读取 ue_bp.d.ts / ue.d.ts 推断生命周期类型，并输出基于
 * registerBlueprintMixin + BlueprintInstance 的一对一 mixin 样板。
 *
 * 用法: node generate-mixin-template.mjs --project=<项目根> --blueprint=/Game/... --blueprint-root=... --mixin-root=...
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadManifest,
  makeBlueprintEntry,
  makeRelativeImportPath,
  saveCatalog,
  saveManifest,
  toProjectPath,
  upsertManifestEntry,
} from './blueprint-manifest-utils.mjs';

const args = process.argv.slice(2);

/** 与 Mixin 示例文件一致的区块分隔线 */
const SECTION_BORDER = '// ===========================================================================';

/** 从命令行读取 --name=value 参数 */
function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

/** 规范化 Content 资产根路径 */
function normalizeAssetRoot(assetRoot) {
  let normalized = assetRoot.trim().replace(/\\/g, '/');
  if (!normalized) {
    normalized = '/Game/Blueprints';
  }
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  while (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * 将 UE 包路径片段转为合法 TypeScript 标识符。
 * 非法字符编码为 $charCode$，数字开头则加下划线前缀。
 */
function filenameToTypeScriptVariableName(filename) {
  let result = '';
  if (filename.length > 0 && /\d/.test(filename[0])) {
    result += '_';
  }
  for (const char of filename) {
    if (/^[A-Za-z0-9_$]$/.test(char)) {
      result += char;
    } else {
      result += `$${char.charCodeAt(0)}$`;
    }
  }
  return result;
}

/** 将包名（如 /Game/Blueprints/Actors/BP_Actor）转为 UE.TypeScript 命名空间路径 */
function makeTypeScriptNamespace(packageName) {
  const segments = packageName.replace(/^\/+/, '').split('/').filter(Boolean);
  return segments.map(filenameToTypeScriptVariableName).join('.');
}

/** 从完整包名剥离根路径，得到 mixin 文件的相对目录 */
function makeRelativePackagePath(packageName, rootPath) {
  let relative = packageName;
  if (relative.startsWith(rootPath)) {
    relative = relative.slice(rootPath.length);
  }
  return relative.replace(/^\/+/, '');
}

/** 从 .d.ts 内容解析 class X extends Y 中的父类名 */
function parseClassExtends(dtsContent, className) {
  const pattern = new RegExp(`class\\s+${className}\\s+extends\\s+([\\w.]+)`, 'm');
  const match = dtsContent.match(pattern);
  return match ? match[1] : null;
}

/** 取类型路径的最后一段（类名） */
function getTypeBaseName(typePath) {
  return typePath.split('.').pop() ?? typePath;
}

/** 原生 UE 类中可直接判定为 Actor 生命周期的根类型 */
const NATIVE_ACTOR_ROOTS = new Set(['Actor', 'Pawn', 'Character']);

/**
 * 沿 ue.d.ts 继承链向上查找，判定生命周期类别：
 * actor | component | other
 */
function resolveNativeLifecycleKind(ueDtsContent, className) {
  const visited = new Set();
  let current = className;

  while (current && !visited.has(current)) {
    visited.add(current);
    if (current === 'ActorComponent') {
      return 'component';
    }
    if (NATIVE_ACTOR_ROOTS.has(current)) {
      return 'actor';
    }

    const extendsType = parseClassExtends(ueDtsContent, current);
    if (!extendsType) {
      return 'other';
    }
    current = getTypeBaseName(extendsType);
  }

  return 'other';
}

/**
 * 沿 ue_bp.d.ts 继承链查找 Blueprint 父类，再映射到原生生命周期。
 * 中间节点以 _C 结尾时继续在 bp 声明中向上追溯。
 */
function resolveLifecycleKind(bpDtsContent, ueDtsContent, className) {
  const visited = new Set();
  let current = className;

  while (current && !visited.has(current)) {
    visited.add(current);

    const extendsType = parseClassExtends(bpDtsContent, current);
    if (!extendsType) {
      return 'other';
    }

    const baseName = getTypeBaseName(extendsType);
    if (baseName.endsWith('_C')) {
      current = baseName;
      continue;
    }

    if (ueDtsContent) {
      return resolveNativeLifecycleKind(ueDtsContent, baseName);
    }

    if (baseName === 'ActorComponent') {
      return 'component';
    }
    if (NATIVE_ACTOR_ROOTS.has(baseName)) {
      return 'actor';
    }

    return 'other';
  }

  return 'other';
}

/** 生成与示例 Mixin 一致的区块标题 (含上下分隔线). */
function makeSectionHeader(title, indent = '') {
  const innerWidth = 75;
  const padding = Math.max(1, Math.floor((innerWidth - [...title].length) / 2));
  return [
    `${indent}${SECTION_BORDER}`,
    `${indent}//${' '.repeat(padding)}${title}`,
    `${indent}${SECTION_BORDER}`,
  ].join('\n');
}

/** 生成文件头模块说明 (见 TypeScript/Doc/CodeFormat.md §4.1). */
function makeModuleHeader(assetName) {
  return [
    '/**',
    ` * [模块说明] ${assetName}: TODO 填写本模块处理的业务.`,
    ' * TODO  1. ReceiveBeginPlay 初始化',
    ' * TODO  2. ReceiveEndPlay 清理运行时状态',
    ' */',
  ].join('\n');
}

/** 根据生命周期类别生成 ReceiveBeginPlay / ReceiveEndPlay 样板. */
function makeLifecycleBody(kind) {
  if (kind === 'actor' || kind === 'component') {
    return [
      '    ReceiveBeginPlay(): void {',
      '    }',
      '',
      '    /** 必须清理定时器与委托, 避免 EndPlay 后仍触发回调. */',
      '    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {',
      '        clearMixinRuntimeState(this);',
      '    }',
    ].join('\n');
  }

  return [
    '    // 未能从 ue_bp.d.ts 推断生命周期; 按需取消注释并实现:',
    '    // ReceiveBeginPlay(): void {',
    '    // }',
    '',
    '    // /** 必须清理定时器与委托, 避免 EndPlay 后仍触发回调. */',
    '    // ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {',
    '    //     clearMixinRuntimeState(this);',
    '    // }',
  ].join('\n');
}

/** 组装完整的 mixin 源文件内容 */
function buildMixinSource({ assetName, entry, lifecycleKind, runtimeImportPath, blueprintsImportPath, globalImportPath }) {
  const runtimeStateInterfaceName = `${assetName}RuntimeState`;

  const sections = [
    makeModuleHeader(assetName),
    "import * as UE from 'ue';",
    `import {`,
    `    ${entry.catalogSymbol},`,
    `    registerBlueprintMixin,`,
    `    type BlueprintInstance,`,
    `} from '${blueprintsImportPath}';`,
    `import {`,
    `    clearMixinRuntimeState,`,
    `    getMixinRuntimeState,`,
    `    type MixinRuntimeState,`,
    `} from '${runtimeImportPath}';`,
    `import { GF } from '${globalImportPath}';`,
    '',
    '',
    makeSectionHeader('配置常量'),
    '',
    '// 模块级常量在此定义, 如 const ORBIT_ANGULAR_SPEED = Math.PI / 2;',
    '',
    '',
    makeSectionHeader('运行时状态'),
    '',
    '// 需要自定义运行时状态时, 扩展 MixinRuntimeState 并在此声明 interface:',
    '//',
    `// interface ${runtimeStateInterfaceName} extends MixinRuntimeState {`,
    '//     /** 示例字段 */',
    '//     example?: unknown;',
    '// }',
    '',
    '',
    makeSectionHeader('Blueprint Mixin 绑定'),
    '',
    `interface ${entry.mixinClassName} extends BlueprintInstance<typeof ${entry.catalogSymbol}> { }`,
    `class ${entry.mixinClassName} implements ${entry.mixinClassName} {`,
    '',
    makeSectionHeader('生命周期函数', '    '),
    '',
    makeLifecycleBody(lifecycleKind),
    '',
    '',
    makeSectionHeader('状态访问方法', '    '),
    '',
    '    // Puerts Mixin 不保证 TS class 字段初始化; 对象级状态请通过 getMixinRuntimeState(this) 管理.',
    '    //',
    `    // private getRuntimeState(): ${runtimeStateInterfaceName} {`,
    `    //     return getMixinRuntimeState(this) as ${runtimeStateInterfaceName};`,
    '    // }',
    '',
    '',
    makeSectionHeader('私有方法', '    '),
    '',
    '    // 监听回调、定时器回调、Overlap 处理等私有方法在此添加.',
    "    // GF.Log(this, 'message', { context: { example: true } });",
    "    // GF.Warn(this, 'warning message');",
    '}',
    '',
    '',
    `registerBlueprintMixin(${entry.catalogSymbol}, ${entry.mixinClassName});`,
    '',
  ];

  return sections.join('\n');
}

// --- 主流程 ---

const blueprintPath = readArg('blueprint', '');
if (!blueprintPath) {
  console.error('[PuertsMixinAutomation] Missing required argument: --blueprint=/Game/Blueprints/BP_XXX');
  process.exit(1);
}

const projectRoot = path.resolve(readArg('project', process.cwd()));
const blueprintRoot = normalizeAssetRoot(readArg('blueprint-root', '/Game/Blueprints'));
const mixinRoot = readArg('mixin-root', 'TypeScript/Mixins/Blueprints');
const manifestFile = toProjectPath(projectRoot, readArg('manifest', 'TypeScript/Mixins/_generated/blueprint-manifest.json'));
const catalogFile = toProjectPath(projectRoot, readArg('catalog', 'TypeScript/Blueprints/_generated/BlueprintCatalog.ts'));
const bpDeclarationFile = path.resolve(projectRoot, 'Typing/ue/ue_bp.d.ts');
const ueDeclarationFile = path.resolve(projectRoot, 'Typing/ue/ue.d.ts');

const normalizedBlueprint = blueprintPath.trim().replace(/\\/g, '/');
const assetName = normalizedBlueprint.split('/').filter(Boolean).pop();
if (!assetName) {
  console.error(`[PuertsMixinAutomation] Invalid blueprint path: ${blueprintPath}`);
  process.exit(1);
}

const entry = makeBlueprintEntry({
  packageName: normalizedBlueprint,
  rootPath: blueprintRoot,
  mixinRoot,
  guid: readArg('guid', ''),
});
if (!makeRelativePackagePath(normalizedBlueprint, blueprintRoot)) {
  console.error(`[PuertsMixinAutomation] Blueprint is outside configured root: ${blueprintPath}`);
  process.exit(1);
}

const manifest = loadManifest(manifestFile);
upsertManifestEntry(manifest, entry);
saveManifest(manifestFile, manifest);
saveCatalog(catalogFile, manifest);

const outputFile = toProjectPath(projectRoot, entry.mixinFile);
const generatedClassName = filenameToTypeScriptVariableName(`${assetName}_C`);
let runtimeImportPath = path.relative(path.dirname(outputFile), path.resolve(projectRoot, 'TypeScript/Runtime')).replace(/\\/g, '/');
if (!runtimeImportPath.startsWith('.')) {
  runtimeImportPath = `./${runtimeImportPath}`;
}
const blueprintsImportPath = makeRelativeImportPath(outputFile, path.resolve(projectRoot, 'TypeScript/Blueprints'));
const globalImportPath = makeRelativeImportPath(outputFile, path.resolve(projectRoot, 'TypeScript/Global'));

let lifecycleKind = 'other';
if (fs.existsSync(bpDeclarationFile)) {
  const bpDtsContent = fs.readFileSync(bpDeclarationFile, 'utf8');
  const ueDtsContent = fs.existsSync(ueDeclarationFile)
    ? fs.readFileSync(ueDeclarationFile, 'utf8')
    : '';
  lifecycleKind = resolveLifecycleKind(bpDtsContent, ueDtsContent, generatedClassName);
} else {
  console.warn(`[PuertsMixinAutomation] ue_bp.d.ts not found at ${bpDeclarationFile}, using generic lifecycle template.`);
}

const source = buildMixinSource({
  assetName,
  entry,
  lifecycleKind,
  runtimeImportPath,
  blueprintsImportPath,
  globalImportPath,
});

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, source, 'utf8');
console.log(`[PuertsMixinAutomation] Generated mixin template: ${outputFile}`);
