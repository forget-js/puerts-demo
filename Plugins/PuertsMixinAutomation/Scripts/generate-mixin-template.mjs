/**
 * 为单个 Blueprint 生成 Puerts mixin TypeScript 模板。
 *
 * 由编辑器模块通过 Node 调用，读取 ue_bp.d.ts / ue.d.ts 推断生命周期类型，
 * 输出 blueprint.mixin 样板代码到 MixinSourceRoot 对应路径。
 *
 * 用法: node generate-mixin-template.mjs --project=<项目根> --blueprint=/Game/... --blueprint-root=... --mixin-root=...
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

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

/** 根据生命周期类别生成 ReceiveBeginPlay/Tick/EndPlay 或通用占位注释 */
function makeLifecycleBody(kind) {
  if (kind === 'actor' || kind === 'component') {
    return [
      '    ReceiveBeginPlay(): void {',
      '    }',
      '',
      '    ReceiveTick(DeltaSeconds: number): void {',
      '    }',
      '',
      '    ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {',
      '    }',
    ].join('\n');
  }

  return '    // Add Blueprint event overrides here.';
}

/** 组装完整的 mixin 源文件内容 */
function buildMixinSource({ packageName, assetName, lifecycleKind }) {
  const classPath = `${packageName}.${assetName}_C`;
  const typeNamespace = makeTypeScriptNamespace(packageName);
  const generatedClassName = filenameToTypeScriptVariableName(`${assetName}_C`);
  const typePath = `UE.${typeNamespace}.${generatedClassName}`;
  const mixinClassName = filenameToTypeScriptVariableName(`${assetName}Mixin`);

  return [
    "import * as UE from 'ue';",
    "import { blueprint } from 'puerts';",
    '',
    `const uclass = UE.Class.Load("${classPath}");`,
    `const jsClass = blueprint.tojs<typeof ${typePath}>(uclass);`,
    '',
    `interface ${mixinClassName} extends ${typePath} { }`,
    `class ${mixinClassName} implements ${mixinClassName} {`,
    makeLifecycleBody(lifecycleKind),
    '}',
    '',
    `blueprint.mixin(jsClass, ${mixinClassName});`,
    '',
  ].join('\n');
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
const bpDeclarationFile = path.resolve(projectRoot, 'Typing/ue/ue_bp.d.ts');
const ueDeclarationFile = path.resolve(projectRoot, 'Typing/ue/ue.d.ts');

const normalizedBlueprint = blueprintPath.trim().replace(/\\/g, '/');
const assetName = normalizedBlueprint.split('/').filter(Boolean).pop();
if (!assetName) {
  console.error(`[PuertsMixinAutomation] Invalid blueprint path: ${blueprintPath}`);
  process.exit(1);
}

const relativePackagePath = makeRelativePackagePath(normalizedBlueprint, blueprintRoot);
if (!relativePackagePath) {
  console.error(`[PuertsMixinAutomation] Blueprint is outside configured root: ${blueprintPath}`);
  process.exit(1);
}

const outputFile = path.resolve(projectRoot, mixinRoot, `${relativePackagePath}.ts`);
const generatedClassName = filenameToTypeScriptVariableName(`${assetName}_C`);

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
  packageName: normalizedBlueprint,
  assetName,
  lifecycleKind,
});

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, source, 'utf8');
console.log(`[PuertsMixinAutomation] Generated mixin template: ${outputFile}`);
