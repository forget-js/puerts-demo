# PuertsDemo 代码格式及编写规范

> 本文档适配 **Unreal Engine 5.7 + Puerts + TypeScript（Blueprint Mixin）** 工程。  
> 配套说明见根目录 [README.md](../../README.md)。

---

## 目录

1. [开发环境要求](#1-开发环境要求)
2. [职责划分与编程原则](#2-职责划分与编程原则)
3. [工程目录与入口约定](#3-工程目录与入口约定)
4. [Mixin 模块写法](#4-mixin-模块写法)
5. [命名规范](#5-命名规范)
6. [蓝图与 TypeScript 协作规范](#6-蓝图与-typescript-协作规范)
7. [消息与模块通信](#7-消息与模块通信)
8. [UI 业务逻辑原则](#8-ui-业务逻辑原则)
9. [注释规范](#9-注释规范)
10. [团队开发行为规则](#10-团队开发行为规则)

---

## 1. 开发环境要求

### 1.1 开发版本

| 组件 | 要求 |
| --- | --- |
| Unreal Engine | 与 `PuertsDemo.uproject` 中 `EngineAssociation` 一致（当前 **5.7**） |
| Visual Studio / Rider | 安装 **「使用 C++ 的游戏开发」** 工作负载；按引擎文档勾选对应 Windows SDK |
| Node.js | 用于 `tsc` 编译、Blueprint Catalog、Mixin 索引/模板生成 |
| Git/SVN | 版本管理（克隆后需按 README 准备 Puerts V8 第三方库） |

首次打开工程后：

1. 在编辑器中执行 Puerts **「生成 *.d.ts」**，生成根目录 `Typing/`。
2. 在项目根目录执行：

```bash
npm install
npm run gen:blueprint-catalog
npm run gen:mixin-index
npm start          # 生成 Catalog / 索引后 tsc --watch
```

### 1.2 输入法与符号

- 输入法默认使用**半角**；中文输入状态下输入英文标点也应为半角。
- **禁止**在代码（含注释）中提交全角标点、中文括号等符号。

### 1.3 编辑器（VS Code / Cursor）

- 安装 **TypeScript** 语言支持；`js/ts.tsdk` 指向项目 `node_modules/typescript`（见 `.vscode/settings.json`）。
- 建议开启**切换窗口自动保存**。
- 脚本编译输出目录：`Content/JavaScript/`（由 `tsconfig.json` 的 `outDir` 决定）。

---

## 2. 职责划分与编程原则

游戏内容开发是**面向策划编程**的，请始终遵守：

| 层级 | 职责 |
| --- | --- |
| **TypeScript（Mixin / Game）** | 游戏流程控制、状态机、数据驱动逻辑、模块间协调 |
| **蓝图** | 表现逻辑：特效、动画、音效、震动、时间轴、UMG 布局与动效 |

**禁止**在 TypeScript 中编写表现细节；UE 蓝图在表现上更合适，应由策划、美术在蓝图中自由发挥。

- 业务需要「触发显示」时：通过 **`BP_XxxXxx`** 调用蓝图函数，由蓝图负责表现。
- 蓝图事件向下传递到脚本：
  - 引擎生命周期：以 **`ReceiveXxx`** 开头（在 Mixin 中 **override**）。
  - 自定义入口：以 **`TS_Xxx`** 开头（原 Lua 时代的 `LUA_Xxx` 统一改为 `TS_`）。

**禁止**在 TypeScript 中直接调用动画播放、粒子发射、音效播放等表现 API；应封装为蓝图 `BP_` 函数，由蓝图实现。

---

## 3. 工程目录与入口约定

```text
TypeScript/
├── Main.ts                          # 常驻入口，只调用 Bootstrap/startGame
├── Bootstrap/
│   ├── startGame.ts                 # 启动编排：错误边界、Mixin、业务模块、ScriptLifecycle 绑定
│   └── shutdownGame.ts              # 关闭编排：Mixin 全量清理、模块 stop/dispose
├── Runtime/
│   ├── ModuleRegistry.ts            # 显式业务模块注册与生命周期
│   ├── MixinState.ts                # get/clear MixinRuntimeState（UniqueID key）
│   ├── ScriptLifecycle.ts           # argv ScriptLifecycle 绑定封装
│   ├── ObjectValidity.ts            # isOwnerValid / guardOwnerAsync
│   ├── DelegateBag.ts               # 委托绑定/释放管理
│   ├── TimerBag.ts                  # setTimeout / setInterval 清理管理
│   ├── ErrorBoundary.ts             # runSafely / runSafelyAsync 错误边界
│   └── BuildInfo.ts                 # 脚本构建版本信息
├── Blueprints/
│   ├── index.ts                      # Blueprint Catalog 运行时入口
│   └── _generated/
│       └── BlueprintCatalog.ts       # 工具生成，勿手改
├── Config/
│   ├── Config.ts                    # 合并 Env 配置，export Config / CC
│   └── Env/
│       ├── config.default.ts        # 默认配置（入库）
│       ├── config.dev.example.ts    # 本地 dev 配置示例（入库）
│       └── config.dev.ts            # 本地覆盖（gitignore，复制 example 后修改）
├── Global/
│   ├── index.ts                     # export { GF, GE }
│   ├── Function.ts                  # GF（Log 等全局函数）
│   └── Enums.ts                     # GE（LogLevel 等）
├── Game/
│   ├── register.ts                  # 显式注册业务模块
│   └── Features/                    # 按功能组织业务模块
├── Mixins/
│   ├── register.ts                  # 固定引入 _generated/mixin-imports（勿手改）
│   ├── _generated/
│   │   ├── blueprint-manifest.json  # 工具维护，记录蓝图 GUID / Mixin 映射
│   │   └── mixin-imports.ts         # 工具生成，勿手改
│   └── Blueprints/                  # 与 /Game/Blueprints 目录结构对应
│       └── .../BP_Xxx.ts
└── Doc/
    ├── CodeFormat.md                # 本文档
    └── MixinReviewChecklist.md      # Mixin 评审短清单
```

| 路径 | 说明 |
| --- | --- |
| `/Game/Blueprints/**` | Puerts 声明生成与 Mixin 路径映射根路径 |
| `/Game/Blueprints/Scripted/**` | 可选自动创建目录；实际项目可继续按业务目录组织蓝图，使用右键显式创建 Mixin |
| `TypeScript/Mixins/Blueprints/Foo/BP_Xxx.ts` | 对应 `/Game/Blueprints/Foo/BP_Xxx`，存在该文件才表示 TS 接管 |
| `TypeScript/Blueprints/index.ts` | Blueprint Catalog 运行时入口；Mixin / Game 只从这里加载蓝图类、获取蓝图类型和注册 mixin |
| `TypeScript/Blueprints/_generated/BlueprintCatalog.ts` | 工具生成的蓝图描述符与类型映射；手写代码禁止修改 |
| `TypeScript/Mixins/_generated/blueprint-manifest.json` | 插件/脚本维护的蓝图 GUID、路径、Mixin 文件和生成符号映射 |
| `TypeScript/Bootstrap/` | 启动编排层，禁止写具体玩法逻辑 |
| `TypeScript/Runtime/` | 跨业务基础设施，只放小而稳定的工具 |
| `TypeScript/Global/` | 全局工具 `GF`、全局枚举 `GE` |
| `TypeScript/Config/` | 运行时配置；日志阈值等由 `GF.Log` 读取，Mixin 一般不改 |
| `Typing/` | Puerts 生成的 UE 声明，**勿提交无关手改** |
| `Content/JavaScript/` | `tsc` 编译产物 |

**配置（Config）：**

- 首次克隆后复制：`Config/Env/config.dev.example.ts` → `Config/Env/config.dev.ts`。
- `config.dev.ts` 已 gitignore，用于本机调试（如 `log.moduleMinLevel` 只放开当前 Mixin）。

**全局日志（Mixin 中）：**

```typescript
import { GF, GE } from '../../../Global';

// 仅 Output Log；无 worldContext 时不会上屏
GF.Log('仅控制台', { level: GE.LogLevel.Verbose });

// Mixin 常用：自动输出 [BP_Xxx][Log] 前缀，默认按配置决定是否上屏
GF.Log(this, '上屏 + Log');

// 级别快捷方法；输出级别也会进入文本，便于搜索 Warning / Error
GF.Warn(this, '配置缺失');

// 结构化数据与上屏控制
GF.Log(this, '自定义', {
    context: { radius: this.bp_radius },
    duration: 5,
    toScreen: true,
});

// 高频日志应提供 key 并限流
GF.Log(this, 'Tick sample', {
    key: 'tick-sample',
    rateLimitSeconds: 1,
});
```

- 只 `import { GF, GE }`，不要零散 `import { LogLevel }`。
- `GF.Log(this, msg)` 第一个参数为 Actor/WorldContext；Mixin 注册后会自动推导蓝图显示名，如 `BP_ConeActor`，业务脚本不要在日志正文里手写 `[BP_Xxx]` 前缀。
- `Config.log.moduleMinLevel` 使用自动显示名作为 key，例如 `BP_ConeActor`。
- `toScreen` 只控制是否上屏，不影响 Output Log / console 输出；`Shipping` 默认不上屏，并受 `shippingMinLevel` 保护。

**降低合并冲突与运行时噪音：**

- 新增 Mixin 后执行 `npm run check`，不要手写 `BlueprintCatalog.ts` 或 `mixin-imports.ts`。
- 只有需要 TS 接管逻辑的蓝图才右键创建 Mixin；纯表现、装饰、数据承载蓝图不创建 Mixin。
- 新建需要脚本的蓝图后，先刷新声明文件，再在 Content Browser 中右键 Blueprint 执行 **Create Puerts Mixin TS Script**。
- 蓝图重命名后应由 PuertsMixinAutomation 同步 Manifest、Catalog、Mixin 文件名与 TS 引用；若未触发，先确认插件已重新编译并加载。
- 业务模块在 `Game/register.ts` 显式注册，由 `Bootstrap/startGame.ts` 统一启动。

---

## 4. Mixin 模块写法

### 4.1 文件头：模块说明

每个 Mixin 文件顶部用块注释说明本模块处理的业务（可用 TODO / DONE 标记进度）：

```typescript
/**
 * [模块说明] 敌人发射器（Launcher）
 * DONE  1. BeginPlay 注册到 Manager
 * TODO  2. 沿 Spline 从终点移动到起点
 *       a. 到达终点逻辑
 *       b. 定时驱动位移
 */
```

### 4.2 标准结构

由 **PuertsMixinAutomation** 生成的模板为基础，保持以下结构顺序：

```typescript
import * as UE from 'ue';
// 按需: import { $ref } from 'puerts';
import {
    BP_ActorBlueprint,
    registerBlueprintMixin,
    type BlueprintInstance,
} from '../../../Blueprints';
import { clearMixinRuntimeState, getMixinRuntimeState, type MixinRuntimeState } from '../../../Runtime';

interface BP_ActorMixin extends BlueprintInstance<typeof BP_ActorBlueprint> { }
class BP_ActorMixin implements BP_ActorMixin {

    // --- 状态访问方法（private）---
    // 注意：Puerts Mixin 不保证 TS class 字段初始化。对象级状态请通过 getMixinRuntimeState(this) 管理。

    // --- 生命周期 ---
    // --- 监听 / 委托回调 ---
    // --- 定时器 ---
    // --- 公共方法 ---
    // --- 私有方法 ---
}

registerBlueprintMixin(BP_ActorBlueprint, BP_ActorMixin);
```

Mixin / Game 手写代码禁止直接写 `UE.Class.Load("/Game/...")` 或蓝图生成类型命名空间。需要加载或引用其他蓝图时，从 `TypeScript/Blueprints` 导入对应 `XxxBlueprint`：

```typescript
import { BP_ConeActorBlueprint, loadBlueprintClass, type BlueprintInstance } from '../../../Blueprints';

const BP_CONE_ACTOR_CLASS = loadBlueprintClass(BP_ConeActorBlueprint);
type ConeActor = BlueprintInstance<typeof BP_ConeActorBlueprint>;
```

**自定义运行时状态：**

Mixin 不是通过正常 `new XxxMixin()` 创建实例，而是把 TS 方法混入已有 UE / 蓝图对象。不要依赖 `constructor` 或 TS class field 初始化保存运行时状态。

```typescript
// 禁止：字段初始化可能不会按普通 TS class 语义执行。
class BP_ActorMixin implements BP_ActorMixin {
    private angle = 0;
    private center = new UE.Vector();
}
```

实例级业务状态必须挂在 `getMixinRuntimeState(this)` 返回的状态对象上。本文件内用私有接口扩展 `MixinRuntimeState`，不要另起模块级 `WeakMap` / `Map` 保存同一类状态。

```typescript
interface OrbitRuntimeState {
    center: UE.Vector;
    angle: number;
}

interface BP_ActorRuntimeState extends MixinRuntimeState {
    orbit?: OrbitRuntimeState;
}

private getRuntimeState(): BP_ActorRuntimeState {
    return getMixinRuntimeState(this) as BP_ActorRuntimeState;
}
```

状态应在 `ReceiveBeginPlay` 或明确的 `initXxx` 中初始化，在 `ReceiveEndPlay` 中随 `clearMixinRuntimeState(this)` 统一释放。`ReceiveTick` 及其调用链只能读取已初始化状态；状态缺失时应直接返回或上报异常，禁止在 Tick 中懒创建业务状态，以免生命周期异常时使用默认值继续运行。

**状态归属：**

- 蓝图/策划需要配置或查看的数据，放蓝图变量，使用 `bp_` 前缀，如 `this.bp_radius`。
- TS 运行时临时状态，放 `getMixinRuntimeState(this)`，如 BeginPlay 记录的圆心、当前角度、委托与定时器。
- 模块常量和类型声明，放模块顶层，如 `const ORBIT_ANGULAR_SPEED`、`interface OrbitRuntimeState`；类型声明编译后不会产生运行时代码。
- 不要把实例运行时状态写成 Mixin class field，也不要通过 `constructor` 初始化。
- 跨蓝图类引用（`loadBlueprintClass`）必须**延迟到使用点**懒加载，禁止在模块顶层执行 `loadBlueprintClass`；可用模块级 `let cachedClass` + 私有 getter 缓存。

```typescript
let cachedTargetClass: UE.Class | undefined;

function getTargetClass(): UE.Class {
    if (!cachedTargetClass) {
        cachedTargetClass = loadBlueprintClass(SomeBlueprint);
    }
    return cachedTargetClass;
}
```

**禁止：**

- 在模块顶层定义可被其他文件误用的可变全局变量。
- 在模块顶层调用 `loadBlueprintClass` / `UE.Class.Load`（会拖慢启动并建立隐式硬引用链）。
- 在类外定义与实例运行时状态相关的「游离」变量（应放入 `MixinRuntimeState`）。
- 在模块顶层定义与类无关的全局函数。

**导入约定：**

- UE 类型统一：`import * as UE from 'ue'`。
- Puerts API：`import { $ref } from 'puerts'`（按需）；Mixin 绑定不要直接导入 `blueprint`，统一使用 `registerBlueprintMixin`。
- 蓝图类加载、跨蓝图类型引用和 mixin 注册统一从 `TypeScript/Blueprints` 导入。
- 跨模块业务类使用**完整 PascalCase 名**，禁止随意缩写（如 `ServerData` 不可写成 `SD`）。

### 4.3 生命周期（蓝图事件）

只有创建了 Mixin 的蓝图才由 TypeScript 接管生命周期。在 Mixin 中 **override** 引擎生命周期后，蓝图侧同事件图实现会被覆盖，即使函数体为空。

```typescript
ReceiveBeginPlay(): void {
    this.addAllListeners();
    this.bindOverlap();
}

ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
    clearMixinRuntimeState(this);
}
```

| 规则 | 说明 |
| --- | --- |
| `ReceiveTick` | 默认不实现；必须 Tick 时需在模块说明中写清原因、性能影响与状态初始化方式，蓝图 Event Graph 也需有连线才会生效 |
| 自定义函数勿以 `Receive` 开头 | `Receive` 保留给引擎 / 蓝图生命周期 |
| `ReceiveEndPlay` / Widget `Destruct` | 必须调用 `clearMixinRuntimeState(this)`，清理定时器、委托、HTTP 请求 |
| 关卡切换 / 脚本退出 | 由 `ScriptLifecycle` 触发 `clearAllMixinRuntimeStates` 兜底（仍须在 EndPlay 中显式清理） |

### 4.3.1 异步逻辑（Mixin 生命周期内）

在 `ReceiveBeginPlay` 等同步生命周期里**火-and-forget** 启动 `async` 逻辑，且 `await` 之后仍要访问 `this` 或其它 UE 对象时，统一使用 `runSafelyAsync` + `guardOwnerAsync`：

```typescript
import { guardOwnerAsync, runSafelyAsync } from '../../../Runtime';

const DEMO_SCOPE = 'BP_Foo.runAsyncWork';

ReceiveBeginPlay(): void {
    void runSafelyAsync(DEMO_SCOPE, () =>
        guardOwnerAsync(this, DEMO_SCOPE, async () => this.runAsyncWork())
    );
}
```

| 组件 | 作用 |
| --- | --- |
| `void` | 不阻塞 UE 生命周期方法；避免 floating promise 告警 |
| `runSafelyAsync(scope, ...)` | 捕获未处理的 Promise rejection，写入 `ErrorBoundary` 日志；`scope` 建议 `类名.方法名` |
| `guardOwnerAsync(this, ...)` | `await` 前后检查 `this` 是否仍有效，避免 Actor 已销毁后继续访问 |

**适用场景**：任何会 `await` 且之后使用 `this` 的异步逻辑（HTTP、延时、未来其它异步 API），**不限于 HTTP**。

**不适用**：纯同步初始化、`ReceiveTick` 内逻辑、从不触碰 UE 对象且无需错误边界的纯 JS 异步。

Puerts 下未处理 rejection 主要依赖 `runSafelyAsync` 与业务内 `try/catch`，不要假设 `globalThis.onunhandledrejection` 一定生效。

### 4.4 监听与委托

```typescript
private addAllListeners(): void {
    // 添加本模块关注的消息
}

/** 监听函数名 = 消息名，On 前缀 */
private onXxxXxx(arg1: unknown): void {
}
```

**禁止：**

- 对同一事件重复注册两个不同的处理函数。
- 在本模块内替其他模块绑定监听。
- 将监听直接绑到临时子对象的方法上（应绑到 `this` 的 `bind` 方法）。

**组件委托**（如 Overlap）优先使用 `getMixinRuntimeState(this).delegates` 记录绑定，避免 `bind(this)` 生成不同函数引用导致无法 `Remove`。

### 4.5 定时调用

优先使用标准 API，在 `ReceiveEndPlay` 中清理：

```typescript
private scheduleDelay(): void {
    getMixinRuntimeState(this).timers.setTimeout(() => this.onDelayed(), 1000);
}

private scheduleLoop(): void {
    getMixinRuntimeState(this).timers.setInterval(() => this.onLoopTick(), 500);
}

private clearAllTimers(): void {
    clearMixinRuntimeState(this);
}
```

**禁止：**

- 在 `ReceiveTick` 及其调用链中使用 `setTimeout` / `setInterval` 做逻辑驱动（应改用 Timer 或事件驱动）。
- 用 `Post` 消息 + 延迟调用的组合规避时序问题（易引发深度 BUG，需主管审批）。

若项目后续封装统一 `DelayCall` / `LoopCall`，须保证 EndPlay 可取消，且不在 Tick 链中调用。

### 4.6 Overlap（场景 Actor）

```typescript
private bindOverlap(): void {
    getMixinRuntimeState(this).delegates.bind(this.Sphere1.OnComponentBeginOverlap, this, this.onSphereBeginOverlap);
}

private releaseOverlap(): void {
    clearMixinRuntimeState(this);
}
```

> 注意：`Remove` 需传入与 `Add` 时**相同引用**的函数；除非有特殊原因，不要手写裸 `.Add(this.onXxx.bind(this))`。

### 4.7 UMG（仅 Widget 相关 Mixin）

- 按钮等控件在 `ReceiveBeginPlay` 或专用 `bindUi()` 中绑定。
- 命名：`onClickedLevel` 对应 Clicked 事件。

### 4.8 公共方法与私有方法

**公共方法**（若存在，通常仅 GameMode 等协调类）：

- 参数命名：`xxxXxx`，禁止 `_xxx` / `xxx_xxx` 等形式。
- 单函数逻辑（不含注释）建议 **≤ 30 行**，尽量一屏内读完。
- 使用 **`GF.Log` / `GF.Warn` / `GF.Error`**（`import { GF, GE } from '.../Global'`）或等价项目封装；业务代码禁止裸用 `print` / `console.*`。
- Mixin 日志前缀由 `registerBlueprintMixin` 自动推导，不在日志正文里手写模块名。

**私有方法**使用 TypeScript `private`，命名仍遵循动词前缀规范（见第 5 节）。

```typescript
private doSomething(otherModule: SomeModule, arg1: number): void {
    // 访问自身成员
    this.someState = arg1;

    // 只读访问其他模块
    const temp = otherModule.someValue;

    // 修改其他模块状态 → 发消息，不直接改
    // eventBus.post(...)

    // 禁止访问其他模块 private 成员
}
```

**访问蓝图成员：**

| 类型 | 命名 |
| --- | --- |
| 组件（脚本引用） | 蓝图侧 **`Ts` 前缀**（策划不可改）；TS 中按生成类型访问，如 `this.Sphere1` |
| 蓝图变量（脚本读写） | 蓝图侧 **`bp_` 前缀**，如 `this.bp_xxxXxx` |
| 蓝图函数（脚本调用） | 蓝图侧 **`BP_` 前缀**，如 `this.BP_ShowEffect()` |

**禁止：**

- 运行时动态给 `this` 挂未在类型/蓝图中声明的属性。
- 在 Mixin 中直接调用 `K2_` 系列；Actor 位移等通用操作应走 `GF` 封装 API（如 `GF.GetActorLocation` / `GF.SetActorLocation`），项目已有更具体封装时走项目封装。
- `for` / `if` 嵌套超过 **2 层**（应拆分函数）。

### 4.9 UE API 调用与封装

Puerts 已生成完整 UE API 声明，AI 和开发者可以查到函数签名；但业务代码不能因此直接散落调用所有 UE API。调用边界按风险划分，而不是追求封装覆盖率。

**Mixin / Game 业务层：**

- 优先使用 `GF` / `GE`、本模块私有方法、蓝图 `BP_` 函数和项目已有封装。
- 可以直接使用低风险读取或构造类 API，如 `GetName()`、简单只读判断、`new UE.Vector(...)`。
- 不直接调用高风险 UE API：`K2_` 系列、带 `$ref` / out 参数、多个 boolean 参数、WorldContext / LatentInfo、Spawn / Destroy / Attach / 位移 / 碰撞 / 显隐 / 输入 / 异步加载等。
- 不直接调用动画、粒子、音效、UMG 动效等表现 API；TS 只触发业务意图，表现交给蓝图 `BP_` 函数。

**GF 封装层：**

- 面向业务语义暴露小而稳定的全局函数，如 `GF.SetActorLocation`、`GF.Log`。
- 负责收敛 `$ref`、默认参数、项目约束和容易误用的 UE 调用。
- 新增封装时只覆盖项目实际需要的高风险/高频能力，不把 UE SDK 全量复制一遍。

**例外：**

- 若 Mixin 中确实需要直接调用高风险 UE API，必须在代码评审中说明原因；可复用或容易误用的调用应先补 `GF` 封装。

---

## 5. 命名规范

### 5.1 变量

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 成员变量 | 小驼峰 `xxxXxx` | `bulletSpeed` |
| 私有成员 | `private` + 小驼峰 | `private eventMap` |
| 禁止 | 不完整缩写 | ~~`bS`~~、~~`buSp`~~ |
| 建议 | 最多 3 个英文单词 | `maxHealth` |

### 5.2 函数前缀

| 前缀 | 含义 |
| --- | --- |
| `init` / `Init` | 初始化（生命周期内常用小写 `initXxx` 作 private） |
| `release` / `Release` | 释放 |
| `add` / `Add` | 添加 |
| `remove` / `Remove` | 删除 |
| `loop` / `Loop` | 循环逻辑 |
| `play` / `Play` | 播放 |
| `spawn` / `Spawn` | 生成 |
| `goTo` / `GoTo` | 跳转 |
| `reduce` / `Reduce` | 扣减 |
| `is` / `Is` | 只读判断 |
| `get` / `Get` | 只读获取 |
| `check` / `Check` | 检测 |
| `set` / `Set` | 设置 |
| `on` / `On` | 监听回调 |
| `load` / `Load` | 加载 |
| `save` / `Save` | 保存 |
| `create` / `Create` | 创建 |
| `update` / `Update` | 更新 |
| `delete` / `Delete` | 删除 |
| `insert` / `Insert` | 插入 |
| `req` / `Req` | 请求 |

类名、文件名、Catalog 符号保持一对一：`BP_Actor.ts` → `BP_ActorMixin` → `BP_ActorBlueprint`。蓝图重命名时由 PuertsMixinAutomation 自动同步。

### 5.3 消息与枚举

- 消息名：全大写下划线 `ITEM_PICKUP`。
- 根据**业务动作**命名，参数名直观。
- **禁止**模糊命名，如 `WIDGET_COLLISION_VISIBLE`（应体现业务含义）。

---

## 6. 蓝图与 TypeScript 协作规范

| 规则 | 说明 |
| --- | --- |
| 表现放蓝图 | 曲线、动画、特效、声音、手柄震动 |
| TS → 蓝图 | 函数必须 **`BP_` 前缀**；经主程审批后再增加上抛接口 |
| 蓝图 → TS | 函数必须 **`TS_` 前缀** |
| 蓝图 Function 参数 | `a_xxxXxx` 命名 |
| `BP_` 函数位置 | 写在 Blueprint **Functions**，不要堆在 Event Graph |
| Event Graph | 能写成 Function 的不要写成 Event，避免「蜘蛛网」 |
| 宏 | 使用引擎自带宏，不自定义宏 |
| 碰撞 | 使用工程预设；**禁止** `SetCollisionEnabled` 私自改碰撞；用 `SetCollisionProfileName` |
| Sequence | 多用 Sequence 节点理清流程 |
| 组件被 TS 引用 | 组件名 **`Ts` 前缀**，策划不可改 |
| 变量类型 | 能用枚举不用 `Byte` / 整型代替 |
| Construction Script | **不要**写逻辑 |

---

## 7. 消息与模块通信

（若项目尚未引入全局 Dispatcher，以下为原则性约定，实现时保持语义一致。）

| 场景 | 做法 |
| --- | --- |
| 大模块之间 | **禁止**直接修改对方成员；通过消息 / 事件总线通知 |
| 模块内部 | 直接方法调用即可，避免过度抽象 |
| 新增全局消息 | 需主管审核 |
| 同步 vs 异步 | 默认 Post（异步）；Send（同步）需审批 |

消息定义示例：

```typescript
/** 拾取道具 */
export const ITEM_PICKUP = {
    name: 'ITEM_PICKUP',
    params: {
        /** 武器对象 */
        grabObj: { index: 1, type: 'object', required: true },
    },
} as const;
```

---

## 8. UI 业务逻辑原则

1. TypeScript 侧 UI 逻辑以**流程控制**为主：显隐、切换、数据灌入。
2. 界面布局与动效固化在 UMG 蓝图中，便于多语言与换皮。
3. 动态列表：从服务器取数后，将**数据**传给 Widget，由蓝图/UMG 绑定展示。
4. 单函数逻辑不超过 30 行。
5. UI 子模块之间可直接访问，不必强行发消息。

---

## 9. 注释规范

### 9.1 变量

```typescript
class BP_HudMixin implements BP_HudMixin {
    /** 消息监听表 */
    private eventMap = new Map<string, Function>();
}
```

### 9.2 函数

一眼能看懂的函数可不写注释。公共 API、消息入口建议 JSDoc：

```typescript
/**
 * 发送消息，接收方下一帧处理
 * @param sender 发送方，一般传 this
 * @param receiver 接收方；广播传 null
 */
post(sender: unknown, receiver: unknown, evt: string, ...args: unknown[]): void {
}
```

### 9.3 消息与复杂逻辑

消息定义、状态机分支、非常规时序处必须注释「为什么这样做」。

---

## 10. 团队开发行为规则

1. **版本管理**：使用 Git/SVN；每天至少拉取一次、提交一次（按团队分支策略）。
2. **生成物**：`Typing/`、`BlueprintCatalog.ts`、`mixin-imports.ts`、`Content/JavaScript/*.js` 是否入库以团队 `.gitignore` 策略为准；克隆后务必 `npm run gen:blueprint-catalog && npm run gen:mixin-index` 再编译。
3. **插件**：`.uproject` 需启用 **Puerts** 与 **PuertsMixinAutomation**。
4. **评审**：新增全局消息、`BP_`/`TS_` 跨层接口、同步 Send、Tick 逻辑、碰撞例外修改须 Code Review。

---

*文档版本：与 PuertsDemo（UE 5.7）工程同步维护。*
