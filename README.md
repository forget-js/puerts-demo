# PuertsDemo

基于 **Unreal Engine 5.7** 与 [**Puerts**](https://github.com/Tencent/puerts) 的示例工程，脚本主要使用 TypeScript Source Map 开发与 **Blueprint Mixin** 模式。

当前工程按正式项目最小骨架组织：`Main.ts` 只负责进入 `Bootstrap/startGame`，业务模块显式注册，Blueprint Mixin 默认显式 opt-in，不再假设所有蓝图都需要脚本。

---

## 环境要求

| 组件 | 说明 |
| --- | --- |
| Unreal Engine | 与本仓库 `PuertsDemo.uproject` 中 `EngineAssociation` 一致的版本（当前为 **5.7**） |
| Node.js | 用于 TypeScript 编译、Blueprint Catalog 与 mixin 索引生成脚本 |

---

## 获取与编译脚本

编译项目后启动编辑器，先点击生成类型说明文件

随后在项目根目录执行：

```bash
npm install
npm run check             # 生成 Blueprint Catalog / Mixin 索引，执行 mixin 校验与 tsc --noEmit
npm start                 # 生成 Catalog / 索引后 tsc --watch，输出到 Content/JavaScript
```

构建脚本产物：

```bash
npm run build             # 写入脚本版本信息，生成 Catalog / 索引并编译到 Content/JavaScript
```

运行时入口仍为 Puerts 侧加载的 **`Main`** 模块（由 `Main.ts` 编译为 `Content/JavaScript/Main.js`，具体在项目 C++ GameInstance 中配置）。`Main.ts` 会调用 `Bootstrap/startGame.ts`，由 Bootstrap 统一安装错误边界、加载 Mixin、注册并启动业务模块。

---

## PuertsMixinAutomation 插件

本仓库附带独立插件：**`Plugins/PuertsMixinAutomation`**（Editor 插件，便于复制到其他 UE + Puerts 项目）。

迁移到其他项目时请：

1. 复制整个 `Plugins/PuertsMixinAutomation` 目录  
2. 在目标工程的 `.uproject` 里 **启用插件 `PuertsMixinAutomation`**  
3. 目标工程仍需已启用 **Puerts** 插件  

### 插件做了哪些事

| 时机 | 行为 |
| --- | --- |
| 点击编辑器工具栏 Puerts「生成 *.d.ts」 | Puerts `DeclarationGenerator` 完成后会触发本插件：按 `AutoCreateMixinPolicy` 创建缺失 Mixin 模板，并刷新 **Manifest / Blueprint Catalog / Mixin 聚合导入** |
| `/Game/Blueprints/**` 下蓝图在编辑器中变更并写入资产注册表 | 防抖后调用声明生成刷新 `Typing`，并维护 Manifest、Catalog 与已有 Mixin 索引 |
| Content Browser 中右键 Blueprint | 选择 **Create Puerts Mixin TS Script**，为选中蓝图显式创建对应 Mixin，并刷新 Manifest、Catalog 与 Mixin 聚合导入 |
| Blueprint 在编辑器中重命名 | 按蓝图 GUID 同步 Manifest、Catalog、Mixin 文件名、Mixin 类名和 TypeScript 引用符号 |

约定（可通过项目设置覆盖）：

| 配置项（默认） | 含义 |
| --- | --- |
| 蓝图根路径 `/Game/Blueprints` | 声明生成与 Mixin 路径映射根路径 |
| 脚本蓝图根路径 `/Game/Blueprints/Scripted` | 可选自动创建目录；右键显式创建不受该目录限制 |
| Mixin TS 输出 `TypeScript/Mixins/Blueprints` | `Content/Blueprints/Foo/BP_XXX` → `TypeScript/Mixins/Blueprints/Foo/BP_XXX.ts` |
| Manifest `TypeScript/Mixins/_generated/blueprint-manifest.json` | 记录蓝图 GUID、资产路径、Mixin 文件和生成符号 |
| Blueprint Catalog `TypeScript/Blueprints/_generated/BlueprintCatalog.ts` | 生成蓝图描述符、运行时加载路径和 TS 类型映射 |
| `AutoCreateMixinPolicy=Disabled` | 正式项目默认不自动创建模板；可选 `ScriptedRootOnly` / `All` |
| `bCreateOnlyMissingMixins=true` | **不覆盖**已存在的 Mixin 文件 |
| `bAutoSyncBlueprintRename=true` | 蓝图重命名后自动同步 Manifest / Catalog / Mixin 文件与 TS 引用 |

Mixin 模板内容由 **`Plugins/PuertsMixinAutomation/Scripts/generate-mixin-template.mjs`** 生成（含 `getMixinRuntimeState` 与基础生命周期 stub）。修改模板只需编辑该脚本，**无需重新编译插件**。

正式项目推荐流程：

1. 新建 Blueprint，并放在 `/Game/Blueprints/**` 的常规业务目录下。
2. 点击 Puerts「生成 *.d.ts」或保存蓝图触发声明刷新。
3. 在 Content Browser 中右键该 Blueprint，选择 **Create Puerts Mixin TS Script**。
4. 插件会创建 `TypeScript/Mixins/Blueprints/.../BP_Xxx.ts`，并刷新 `blueprint-manifest.json`、`BlueprintCatalog.ts` 与 `_generated/mixin-imports.ts`。

命令行备用方式：

```bash
npm run gen:mixin-template -- --blueprint=/Game/Blueprints/BP_Cube
npm run gen:blueprint-catalog
npm run gen:mixin-index
```

正式项目建议：纯表现、装饰、数据承载蓝图不要创建 Mixin；只有需要 TypeScript 接管逻辑或生命周期的蓝图才右键 opt-in。

### 编辑器里改配置

- 编辑器路径：**Edit → Project Settings → Plugins → Puerts Mixin Automation**

也可在 **`Config/DefaultPuertsMixinAutomation.ini`** 中维护默认值（`/Script/PuertsMixinAutomation.PuertsMixinAutomationSettings`）。

---

## TypeScript 入口约定（降低合并冲突）

- **`TypeScript/Main.ts`**：常驻入口，只调用 `Bootstrap/startGame`。  
- **`TypeScript/Bootstrap/startGame.ts`**：启动编排，负责错误边界、Mixin 加载、业务模块注册与启动。  
- **`TypeScript/Runtime/`**：轻量运行时基础层，包括模块生命周期、委托清理、定时器清理、错误边界和脚本版本信息。  
- **`TypeScript/Blueprints/index.ts`**：Blueprint Catalog 运行时入口；手写代码通过这里加载蓝图类、获取类型、注册 mixin。  
- **`TypeScript/Blueprints/_generated/BlueprintCatalog.ts`**：由 Manifest 生成，集中保存蓝图描述符与类型映射，勿手改。  
- **`TypeScript/Mixins/register.ts`**：固定引入聚合文件（人工一般不动）。  
- **`TypeScript/Mixins/_generated/blueprint-manifest.json`**：由插件/脚本维护，记录蓝图 GUID 与一对一 Mixin 映射。  
- **`TypeScript/Mixins/_generated/mixin-imports.ts`**：**由编辑器插件或 `npm run gen:mixin-index` 生成**，优先按 Manifest 写入 side-effect imports。  
- **`TypeScript/Game/register.ts`**：业务模块显式注册入口，由 Bootstrap 调用。

生成的 **相对路径应为 `../Blueprints/xxx`**（从 `_generated` 回到同级 `Mixins/Blueprints`）。若出现异常路径，请先重新编译 **PuertsMixinAutomation** 编辑器模块并触发一次索引生成。

手写 Mixin / Game 代码不要直接写 `/Game/...` 或 `UE.Game.Blueprints...`，应引用 `TypeScript/Blueprints` 导出的 `XxxBlueprint`、`BlueprintInstance`、`loadBlueprintClass` 或 `registerBlueprintMixin`。

---

## Git：`.gitignore` 相关说明

- **`Plugins/Puerts/ThirdParty/v8_9.4.146.24/`**：V8 预编译库与头文件目录（含 Win64 等平台 `.lib`，单文件可超过 GitHub 100MB 限制），**不入库**。克隆本仓库后，请从 [**Puerts**](https://github.com/Tencent/puerts) 与你当前 `Plugins/Puerts` 版本一致的发布包或源码配套说明中，准备同名的 `v8_9.4.146.24` 目录，放到本工程 **`Plugins/Puerts/ThirdParty/`** 下（与插件内 `Puerts/ThirdParty` 布局一致），再打开 UE 工程。

- **`/Typing/`**：Puerts 生成的 UE 声明等（根目录）；勿用无斜杠前缀的 `Typing/`，否则会误忽略 `Plugins/Puerts/Typing`。  
- **`/TypeScript/Mixins/_generated/blueprint-manifest.json`**：记录蓝图 GUID 与 Mixin 映射；建议提交，便于蓝图重命名同步与团队一致性校验。  
- **`/TypeScript/Blueprints/_generated/BlueprintCatalog.ts`**、**`/TypeScript/Mixins/_generated/mixin-imports.ts`**：由工具生成，可按团队策略不再提交以减少冲突。**克隆或清理仓库后请先执行 `npm run gen:blueprint-catalog && npm run gen:mixin-index`。**  
- **`/Content/JavaScript/**/*.js` 与 `.js.map`**：（若保持取消注释）不提交脚本编译产物时，始终以 `tsc` 本地/CI 产出为准。

若这些生成文件曾被提交过，改为「仅本地生成」时可执行一次：

```bash
git rm --cached TypeScript/Blueprints/_generated/BlueprintCatalog.ts
git rm --cached TypeScript/Mixins/_generated/mixin-imports.ts
```

然后提交 `.gitignore` 变更（具体以团队流程为准）。

---

## 常见问题

**Q：运行时报错找不到 `Mixins/_generated` 下某个 `Blueprints/xxx` 模块**  
A：多为 `mixin-imports` 与 Manifest 不同步，或相对路径错误（应为 `../Blueprints/...`）。重新编译 **PuertsMixinAutomation** 插件后，在编辑器点一次 Puerts 生成声明，或执行 `npm run gen:blueprint-catalog && npm run gen:mixin-index` 并重新 `tsc`。

**Q：新建蓝图后没有自动出现 Mixin 文件**  
A：这是正式项目默认行为。默认 `AutoCreateMixinPolicy=Disabled`，不会自动创建 Mixin。需要脚本的蓝图请在 Content Browser 中右键该 Blueprint，选择 **Create Puerts Mixin TS Script**。

**Q：蓝图重命名后脚本没有自动同步**  
A：先确认 **PuertsMixinAutomation** C++ 模块已重新编译并在当前编辑器会话中加载。若重命名发生在旧模块运行期间，可执行：

```bash
node Plugins/PuertsMixinAutomation/Scripts/generate-blueprint-catalog.mjs --sync-blueprint --blueprint=/Game/Blueprints/.../BP_New --old-blueprint=/Game/Blueprints/.../BP_Old --rename-scripts
npm run gen:mixin-index
```

---

## 许可与上游

- **Puerts** 与 **Unreal Engine** 分别遵循其各自仓库的许可；本示例工程除插件与脚本组织外，以学习演示为主。
