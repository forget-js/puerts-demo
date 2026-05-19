# PuertsDemo

基于 **Unreal Engine 5.7** 与 [**Puerts**](https://github.com/Tencent/puerts) 的示例工程，脚本主要使用 TypeScript Source Map 开发与 **Blueprint Mixin** 模式。

---

## 环境要求

| 组件 | 说明 |
|------|------|
| Unreal Engine | 与本仓库 `PuertsDemo.uproject` 中 `EngineAssociation` 一致的版本（当前为 **5.7**） |
| Node.js | 用于 TypeScript 编译与 mixin 索引生成脚本 |

---

## 获取与编译脚本

编译项目后启动编辑器，先点击生成类型说明文件

随后在项目根目录执行：

```bash
npm install
npm run gen:mixin-index   # 生成 TypeScript/Mixins/_generated/mixin-imports.ts（详见下文）
npm start                 # 等价于生成索引后再 tsc --watch，输出到 Content/JavaScript
```

仅检查类型可不监听：

```bash
npm run gen:mixin-index
npx tsc --noEmit
```

运行时入口仍为 Puerts 侧加载的 **`Main`** 模块（由 `Main.ts` 编译为 `Content/JavaScript/Main.js`，具体在项目 C++ GameInstance 中配置）。

---

## PuertsMixinAutomation 插件

本仓库附带独立插件：**`Plugins/PuertsMixinAutomation`**（Editor 插件，便于复制到其他 UE + Puerts 项目）。

迁移到其他项目时请：

1. 复制整个 `Plugins/PuertsMixinAutomation` 目录  
2. 在目标工程的 `.uproject` 里 **启用插件 `PuertsMixinAutomation`**  
3. 目标工程仍需已启用 **Puerts** 插件  

### 插件做了哪些事

| 时机 | 行为 |
|------|------|
| 点击编辑器工具栏 Puerts「生成 *.d.ts」 | Puerts `DeclarationGenerator` 完成后会触发本插件：**为缺失文件生成 Mixin 模板**（由 Node 脚本 `generate-mixin-template.mjs` 写入），并刷新 **Mixin 聚合导入** |
| `/Game/Blueprints/**` 下蓝图在编辑器中变更并写入资产注册表 | 防抖后调用声明生成刷新 `Typing`，并同上更新 Mixin 与索引 |

约定（可通过项目设置覆盖）：

| 配置项（默认） | 含义 |
|----------------|------|
| 蓝图根路径 `/Game/Blueprints` | 仅对该路径递归下的 Blueprint 做自动化 |
| Mixin TS 输出 `TypeScript/Mixins/Blueprints` | `Content/Blueprints/Foo/BP_XXX` → `TypeScript/Mixins/Blueprints/Foo/BP_XXX.ts` |
| `bCreateOnlyMissingMixins=true` | **不覆盖**已存在的 Mixin 文件 |

Mixin 模板内容由 **`Plugins/PuertsMixinAutomation/Scripts/generate-mixin-template.mjs`** 生成（含 `ReceiveBeginPlay` / `ReceiveTick` / `ReceiveEndPlay` 等生命周期 stub）。修改模板只需编辑该脚本，**无需重新编译插件**。本地调试示例：

```bash
npm run gen:mixin-template -- --blueprint=/Game/Blueprints/BP_Cube
```

### 编辑器里改配置

**Edit → Project Settings → Plugins → Puerts Mixin Automation**

也可在 **`Config/DefaultPuertsMixinAutomation.ini`** 中维护默认值（`/Script/PuertsMixinAutomation.PuertsMixinAutomationSettings`）。

---

## TypeScript 入口约定（降低合并冲突）

- **`TypeScript/Main.ts`**：常驻入口，只保留少量静态 `import`。  
- **`TypeScript/Mixins/register.ts`**：固定引入聚合文件（人工一般不动）。  
- **`TypeScript/Mixins/_generated/mixin-imports.ts`**：**由编辑器插件或 `npm run gen:mixin-index` 生成**，按目录扫描 `Mixins/Blueprints/**/*.ts` 写入 side-effect imports。  
- **`TypeScript/Game/register.ts`**：业务侧注册拆分入口，可按模块继续拆多个 `Game/**/register.ts` 再在 `Main` 聚合。

生成的 **相对路径应为 `../Blueprints/xxx`**（从 `_generated` 回到同级 `Mixins/Blueprints`）。若出现异常路径，请先重新编译 **PuertsMixinAutomation** 编辑器模块并触发一次索引生成。

---

## Git：`.gitignore` 相关说明

- **`Plugins/Puerts/ThirdParty/v8_9.4.146.24/`**：V8 预编译库与头文件目录（含 Win64 等平台 `.lib`，单文件可超过 GitHub 100MB 限制），**不入库**。克隆本仓库后，请从 [**Puerts**](https://github.com/Tencent/puerts) 与你当前 `Plugins/Puerts` 版本一致的发布包或源码配套说明中，准备同名的 `v8_9.4.146.24` 目录，放到本工程 **`Plugins/Puerts/ThirdParty/`** 下（与插件内 `Puerts/ThirdParty` 布局一致），再打开 UE 工程。

- **`/Typing/`**：Puerts 生成的 UE 声明等（根目录）；勿用无斜杠前缀的 `Typing/`，否则会误忽略 `Plugins/Puerts/Typing`。  
- **`/TypeScript/Mixins/_generated/mixin-imports.ts`**：由工具生成，可按团队策略不再提交以减少冲突。**克隆或清理仓库后请先执行 `npm run gen:mixin-index`。**  
- **`/Content/JavaScript/**/*.js` 与 `.js.map`**：（若保持取消注释）不提交脚本编译产物时，始终以 `tsc` 本地/CI 产出为准。

若该 `mixin-imports.ts` 曾被提交过，改为「仅本地生成」时可执行一次：

```bash
git rm --cached TypeScript/Mixins/_generated/mixin-imports.ts
```

然后提交 `.gitignore` 变更（具体以团队流程为准）。

---

## 常见问题

**Q：运行时报错找不到 `Mixins/_generated` 下某个 `Blueprints/xxx` 模块**  
A：多为 `mixin-imports` 里相对路径错误（应为 `../Blueprints/...`）。重新编译 **PuertsMixinAutomation** 插件后，在编辑器点一次 Puerts 生成声明，或执行 `npm run gen:mixin-index` 并重新 `tsc`。

**Q：新建蓝图后没有自动出现 Mixin 文件**  
A：需保证蓝图在 **`/Game/Blueprints/**`** 下，并已触发一次「生成声明」或依赖插件的蓝图保存逻辑；同时确认 `.uproject` 已启用 **PuertsMixinAutomation**。

---

## 许可与上游

- **Puerts** 与 **Unreal Engine** 分别遵循其各自仓库的许可；本示例工程除插件与脚本组织外，以学习演示为主。
