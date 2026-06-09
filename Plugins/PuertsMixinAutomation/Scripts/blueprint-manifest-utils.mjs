/**
 * Blueprint Manifest / Catalog 生成工具函数。
 *
 * Manifest 负责记录蓝图 GUID、当前资产路径、对应 mixin 文件和生成符号；
 * Catalog 则把这些数据转换为 TS 运行时可加载、可推导类型的蓝图描述符。
 */
import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST_VERSION = 1;

/** 规范化项目相对路径，便于 C++ 插件和 Node 脚本共用同一配置值。 */
export function normalizeProjectRelativePath(projectRelativePath) {
  return projectRelativePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

/** 规范化 UE Content 资产根路径，如 `Game/Blueprints` -> `/Game/Blueprints`。 */
export function normalizeAssetRoot(assetRoot) {
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
 * 非法字符编码为 `$charCode$`，数字开头则加下划线前缀。
 */
export function filenameToTypeScriptVariableName(filename) {
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

/** 将包名（如 /Game/Blueprints/Actors/BP_Actor）转为 UE.TypeScript 命名空间路径。 */
export function makeTypeScriptNamespace(packageName) {
  const segments = packageName.replace(/^\/+/, '').split('/').filter(Boolean);
  return segments.map(filenameToTypeScriptVariableName).join('.');
}

/** 从完整包名剥离根路径，得到 mixin 文件相对路径。 */
export function makeRelativePackagePath(packageName, rootPath) {
  let relative = packageName.trim().replace(/\\/g, '/');
  if (relative.startsWith(rootPath)) {
    relative = relative.slice(rootPath.length);
  }
  return relative.replace(/^\/+/, '');
}

/** 生成 Puerts / UE 蓝图生成类加载路径。 */
export function makeGeneratedClassPath(packageName) {
  const assetName = getAssetName(packageName);
  return `${packageName}.${assetName}_C`;
}

/** 取 UE 包路径末尾资产名。 */
export function getAssetName(packageName) {
  return packageName.split('/').filter(Boolean).pop() ?? '';
}

/** 编辑器尚未提供真实 GUID 时，用 legacy key 保持现有项目可迁移。 */
export function makeBlueprintGuid(packageName, explicitGuid) {
  if (explicitGuid && explicitGuid.trim()) {
    return explicitGuid.trim();
  }
  return `legacy:${packageName}`;
}

/** 根据蓝图包路径生成 Manifest 条目，并保持 mixin 文件与蓝图一对一命名。 */
export function makeBlueprintEntry({ packageName, rootPath, mixinRoot, guid }) {
  const normalizedPackageName = packageName.trim().replace(/\\/g, '/');
  const assetName = getAssetName(normalizedPackageName);
  const relativePackagePath = makeRelativePackagePath(normalizedPackageName, rootPath);
  const generatedClassName = filenameToTypeScriptVariableName(`${assetName}_C`);
  const typeNamespace = makeTypeScriptNamespace(normalizedPackageName);
  const safeAssetName = filenameToTypeScriptVariableName(assetName);

  return {
    blueprintGuid: makeBlueprintGuid(normalizedPackageName, guid),
    packageName: normalizedPackageName,
    assetName,
    generatedClassPath: makeGeneratedClassPath(normalizedPackageName),
    typePath: `UE.${typeNamespace}.${generatedClassName}`,
    mixinFile: `${normalizeProjectRelativePath(mixinRoot)}/${relativePackagePath}.ts`,
    mixinClassName: `${safeAssetName}Mixin`,
    catalogSymbol: `${safeAssetName}Blueprint`,
    previousCatalogSymbols: [],
    autoManaged: true,
  };
}

/** 读取 Manifest；不存在时返回空结构，便于首次生成。 */
export function loadManifest(manifestFile) {
  if (!fs.existsSync(manifestFile)) {
    return { version: MANIFEST_VERSION, blueprints: [] };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!Array.isArray(manifest.blueprints)) {
    manifest.blueprints = [];
  }
  manifest.version = manifest.version ?? MANIFEST_VERSION;
  return manifest;
}

/** 稳定排序并写回 Manifest，减少生成文件 diff 噪声。 */
export function saveManifest(manifestFile, manifest) {
  manifest.blueprints.sort((a, b) => a.mixinFile.localeCompare(b.mixinFile));
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/** 优先按 GUID 查找；重命名补偿时可回退旧包路径。 */
export function findManifestEntry(manifest, { guid, packageName, oldPackageName }) {
  if (guid) {
    const byGuid = manifest.blueprints.find((entry) => entry.blueprintGuid === guid);
    if (byGuid) {
      return byGuid;
    }
  }

  if (oldPackageName) {
    const byOldPackage = manifest.blueprints.find((entry) => entry.packageName === oldPackageName);
    if (byOldPackage) {
      return byOldPackage;
    }
  }

  return manifest.blueprints.find((entry) => entry.packageName === packageName);
}

/** 新增或更新 Manifest 条目，并记录旧 Catalog 符号供静态校验发现漏改引用。 */
export function upsertManifestEntry(manifest, newEntry, { oldPackageName } = {}) {
  const existing = findManifestEntry(manifest, {
    guid: newEntry.blueprintGuid.startsWith('legacy:') ? '' : newEntry.blueprintGuid,
    packageName: newEntry.packageName,
    oldPackageName,
  });

  if (!existing) {
    manifest.blueprints.push(newEntry);
    return { entry: newEntry, previous: null };
  }

  const previous = { ...existing };
  if (existing.catalogSymbol && existing.catalogSymbol !== newEntry.catalogSymbol) {
    const previousSymbols = new Set([...(existing.previousCatalogSymbols ?? []), existing.catalogSymbol]);
    newEntry.previousCatalogSymbols = [...previousSymbols];
  } else {
    newEntry.previousCatalogSymbols = existing.previousCatalogSymbols ?? [];
  }

  Object.assign(existing, newEntry);
  return { entry: existing, previous };
}

/** 将项目相对路径转换为磁盘绝对路径。 */
export function toProjectPath(projectRoot, projectRelativePath) {
  return path.resolve(projectRoot, normalizeProjectRelativePath(projectRelativePath));
}

/** 为生成的 TS 文件计算到公共目录的相对 import 路径。 */
export function makeRelativeImportPath(fromFile, toDirectory) {
  let importPath = path.relative(path.dirname(fromFile), toDirectory).replace(/\\/g, '/');
  if (!importPath.startsWith('.')) {
    importPath = `./${importPath}`;
  }
  return importPath;
}

/** 根据 Manifest 生成 BlueprintCatalog.ts 源码。 */
export function makeCatalogSource(manifest) {
  const activeEntries = manifest.blueprints
    .filter((entry) => !entry.missing)
    .sort((a, b) => a.catalogSymbol.localeCompare(b.catalogSymbol));
  const symbols = activeEntries.map((entry) => entry.catalogSymbol);

  const symbolType = symbols.length > 0
    ? symbols.map((symbol) => `    | '${symbol}'`).join('\n')
    : '    never';

  const constants = activeEntries.map((entry) => [
    `export const ${entry.catalogSymbol} = {`,
    `    symbol: '${entry.catalogSymbol}',`,
    `    guid: '${entry.blueprintGuid}',`,
    `    path: '${entry.generatedClassPath}',`,
    `} as const;`,
  ].join('\n'));

  const catalogEntries = activeEntries.map((entry) => `    ${entry.catalogSymbol},`);
  const instanceMapEntries = activeEntries.map((entry) => `    ${entry.catalogSymbol}: ${entry.typePath};`);
  const classMapEntries = activeEntries.map((entry) => `    ${entry.catalogSymbol}: typeof ${entry.typePath};`);

  return [
    '/**',
    ' * Auto-generated Blueprint Catalog.',
    ' *',
    ' * Do not edit directly; generated from TypeScript/Mixins/_generated/blueprint-manifest.json.',
    ' */',
    "import * as UE from 'ue';",
    '',
    'export type BlueprintSymbol =',
    `${symbolType};`,
    '',
    'export interface BlueprintDescriptor<TSymbol extends BlueprintSymbol = BlueprintSymbol> {',
    '    readonly symbol: TSymbol;',
    '    readonly guid: string;',
    '    readonly path: string;',
    '}',
    '',
    ...constants.flatMap((constant) => [constant, '']),
    'export const BlueprintCatalog = {',
    ...catalogEntries,
    '} as const;',
    '',
    'export type BlueprintInstanceMap = {',
    ...instanceMapEntries,
    '};',
    '',
    'export type BlueprintClassMap = {',
    ...classMapEntries,
    '};',
    '',
    'export type BlueprintInstance<TDescriptor extends BlueprintDescriptor> = BlueprintInstanceMap[TDescriptor[\'symbol\']];',
    'export type BlueprintClass<TDescriptor extends BlueprintDescriptor> = BlueprintClassMap[TDescriptor[\'symbol\']];',
    '',
  ].join('\n');
}

/** 写出 BlueprintCatalog.ts。 */
export function saveCatalog(catalogFile, manifest) {
  fs.mkdirSync(path.dirname(catalogFile), { recursive: true });
  fs.writeFileSync(catalogFile, makeCatalogSource(manifest), 'utf8');
}

/** 递归收集 TypeScript 源文件，排除声明文件。 */
export function walkTypeScriptFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(entryPath);
    }
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      return [entryPath];
    }
    return [];
  });
}
