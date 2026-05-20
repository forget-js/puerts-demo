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
|------|------|
| Unreal Engine | 与 `PuertsDemo.uproject` 中 `EngineAssociation` 一致（当前 **5.7**） |
| Visual Studio / Rider | 安装 **「使用 C++ 的游戏开发」** 工作负载；按引擎文档勾选对应 Windows SDK |
| Node.js | 用于 `tsc` 编译与 Mixin 索引/模板生成 |
| Git/SVN | 版本管理（克隆后需按 README 准备 Puerts V8 第三方库） |

首次打开工程后：

1. 在编辑器中执行 Puerts **「生成 *.d.ts」**，生成根目录 `Typing/`。
2. 在项目根目录执行：

```bash
npm install
npm run gen:mixin-index
npm start          # 或 npx tsc --watch
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
|------|------|
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

```
TypeScript/
├── Main.ts                          # 常驻入口，仅保留少量静态 import
├── Game/
│   └── register.ts                  # 业务脚本注册（可按模块继续拆分）
├── Mixins/
│   ├── register.ts                  # 固定引入 _generated/mixin-imports（勿手改）
│   ├── _generated/
│   │   └── mixin-imports.ts         # 工具生成，勿手改
│   └── Blueprints/                  # 与 /Game/Blueprints 目录结构对应
│       └── .../BP_Xxx.ts
└── Doc/
    └── CodeFormat.md                # 本文档
```

| 路径 | 说明 |
|------|------|
| `/Game/Blueprints/**` | 参与 Mixin 自动化的蓝图根路径（可在插件设置中覆盖） |
| `TypeScript/Mixins/Blueprints/Foo/BP_Xxx.ts` | 对应 `Content/Blueprints/Foo/BP_Xxx` |
| `Typing/` | Puerts 生成的 UE 声明，**勿提交无关手改** |
| `Content/JavaScript/` | `tsc` 编译产物 |

**降低合并冲突：**

- 新增 Mixin 后执行 `npm run gen:mixin-index`，不要手写 `mixin-imports.ts`。
- 业务注册写在 `Game/register.ts` 或子模块 `register.ts`，由 `Main.ts` 聚合引入。

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
import { blueprint } from 'puerts';
// 按需: import { $ref } from 'puerts';

const uclass = UE.Class.Load("/Game/Blueprints/Actors/BP_Actor.BP_Actor_C");
const jsClass = blueprint.tojs<typeof UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C>(uclass);

interface BP_ActorMixin extends UE.Game.Blueprints.Actors.BP_Actor.BP_Actor_C { }
class BP_ActorMixin implements BP_ActorMixin {

    // --- 成员变量（private）---
    // --- 生命周期 ---
    // --- 监听 / 委托回调 ---
    // --- 定时器 ---
    // --- 公共方法 ---
    // --- 私有方法 ---
}

blueprint.mixin(jsClass, BP_ActorMixin);
```

**禁止：**

- 在模块顶层定义可被其他文件误用的可变全局变量。
- 在类外定义与模块状态相关的「游离」变量（应放入 Mixin 类成员）。
- 在模块顶层定义与类无关的全局函数。

**导入约定：**

- UE 类型统一：`import * as UE from 'ue'`。
- Puerts API：`import { blueprint, $ref } from 'puerts'`（按需）。
- 跨模块业务类使用**完整 PascalCase 名**，禁止随意缩写（如 `ServerData` 不可写成 `SD`）。

### 4.3 生命周期（蓝图事件）

在 Mixin 中 **override** 引擎生命周期；一旦 override，蓝图侧同事件图实现会被覆盖，即使函数体为空。

```typescript
ReceiveBeginPlay(): void {
    this.addAllListeners();
    this.bindOverlap();
}

ReceiveEndPlay(EndPlayReason: UE.EEndPlayReason): void {
    this.removeAllListeners();
    this.releaseOverlap();
    this.clearAllTimers();
}

ReceiveTick(DeltaSeconds: number): void {
    // 非必要勿实现；Tick 耗性能
}
```

| 规则 | 说明 |
|------|------|
| `ReceiveTick` | 默认不实现；必须 Tick 时，蓝图 Event Graph 需有连线才会生效 |
| 自定义函数勿以 `Receive` 开头 | `Receive` 保留给引擎 / 蓝图生命周期 |
| `ReceiveEndPlay` | 必须清理定时器、委托、全局监听 |

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

**组件委托**（如 Overlap）使用 `.Add(this.onXxx.bind(this))`，在 `ReceiveEndPlay` 中 `.Remove` 并置空引用。

### 4.5 定时调用

优先使用标准 API，在 `ReceiveEndPlay` 中清理：

```typescript
// 一次性延迟（类似蓝图 Delay）
private delayTimerId?: ReturnType<typeof setTimeout>;

private scheduleDelay(): void {
    this.delayTimerId = setTimeout(() => this.onDelayed(), 1000);
}

// 循环（类似蓝图 Set Timer Looping）
private loopTimerId?: ReturnType<typeof setInterval>;

private scheduleLoop(): void {
    this.loopTimerId = setInterval(() => this.onLoopTick(), 500);
}

private clearAllTimers(): void {
    if (this.delayTimerId !== undefined) {
        clearTimeout(this.delayTimerId);
        this.delayTimerId = undefined;
    }
    if (this.loopTimerId !== undefined) {
        clearInterval(this.loopTimerId);
        this.loopTimerId = undefined;
    }
}
```

**禁止：**

- 在 `ReceiveTick` 及其调用链中使用 `setTimeout` / `setInterval` 做逻辑驱动（应改用 Timer 或事件驱动）。
- 用 `Post` 消息 + 延迟调用的组合规避时序问题（易引发深度 BUG，需主管审批）。

若项目后续封装统一 `DelayCall` / `LoopCall`，须保证 EndPlay 可取消，且不在 Tick 链中调用。

### 4.6 Overlap（场景 Actor）

```typescript
private bindOverlap(): void {
    this.Sphere1.OnComponentBeginOverlap.Add(this.onSphereBeginOverlap.bind(this));
}

private releaseOverlap(): void {
    this.Sphere1.OnComponentBeginOverlap.Remove(this.onSphereBeginOverlap.bind(this));
}
```

> 注意：`Remove` 需传入与 `Add` 时**相同引用**的函数；可将 `bind` 结果存为成员变量。

### 4.7 UMG（仅 Widget 相关 Mixin）

- 按钮等控件在 `ReceiveBeginPlay` 或专用 `bindUi()` 中绑定。
- 命名：`onClickedLevel` 对应 Clicked 事件。

### 4.8 公共方法与私有方法

**公共方法**（若存在，通常仅 GameMode 等协调类）：

- 参数命名：`xxxXxx`，禁止 `_xxx` / `xxx_xxx` 等形式。
- 单函数逻辑（不含注释）建议 **≤ 30 行**，尽量一屏内读完。
- 使用 `console.log` 或项目统一日志封装；**禁止**裸用 `print`。
- 日志内容中避免大量 `-` 字符（可用 `=` 代替分隔线）。

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
|------|------|
| 组件（脚本引用） | 蓝图侧 **`Ts` 前缀**（策划不可改）；TS 中按生成类型访问，如 `this.Sphere1` |
| 蓝图变量（脚本读写） | 蓝图侧 **`bp_` 前缀**，如 `this.bp_xxxXxx` |
| 蓝图函数（脚本调用） | 蓝图侧 **`BP_` 前缀**，如 `this.BP_ShowEffect()` |

**禁止：**

- 运行时动态给 `this` 挂未在类型/蓝图中声明的属性。
- 直接调用 `K2_` 系列（若项目有封装层，走封装 API）。
- `for` / `if` 嵌套超过 **2 层**（应拆分函数）。

---

## 5. 命名规范

### 5.1 变量

| 类型 | 规则 | 示例 |
|------|------|------|
| 成员变量 | 小驼峰 `xxxXxx` | `bulletSpeed` |
| 私有成员 | `private` + 小驼峰 | `private eventMap` |
| 禁止 | 不完整缩写 | ~~`bS`~~、~~`buSp`~~ |
| 建议 | 最多 3 个英文单词 | `maxHealth` |

### 5.2 函数前缀

| 前缀 | 含义 |
|------|------|
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

类名、文件名：`BP_Actor.ts` → 类 `BP_ActorMixin`。

### 5.3 消息与枚举

- 消息名：全大写下划线 `ITEM_PICKUP`。
- 根据**业务动作**命名，参数名直观。
- **禁止**模糊命名，如 `WIDGET_COLLISION_VISIBLE`（应体现业务含义）。

---

## 6. 蓝图与 TypeScript 协作规范

| 规则 | 说明 |
|------|------|
| 表现放蓝图 | 曲线、动画、特效、声音、手柄震动 |
| TS → 蓝图 | 函数必须 **`BP_` 前缀**；经主程审批后再增加上抛接口 |
| 蓝图 → TS | 函数必须 **`TS_` 前缀** |
| 蓝图 Function 参数 | `a_xxxXxx` 命名 |
| `BP_` 函数位置 | 写在 Blueprint **Functions**，不要堆在 Event Graph |
| Event Graph | 能写成 Function 的不要写成 Event，避免「蜘蛛网」 |
| 宏 | 使用引擎自带宏，不自定义宏 |
| 碰撞 | 使用工程预设；**禁止** `SetCollisionEnabled` 私自改碰撞；用 `SetCollisionProfileName` |
| Sequence | 多用 Sequence 节点理清流程 |
| 组件被 TS 引用 | 组件名 **`Lua` 前缀**，策划不可改 |
| 变量类型 | 能用枚举不用 `Byte` / 整型代替 |
| Construction Script | **不要**写逻辑 |

---

## 7. 消息与模块通信

（若项目尚未引入全局 Dispatcher，以下为原则性约定，实现时保持语义一致。）

| 场景 | 做法 |
|------|------|
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
2. **生成物**：`Typing/`、`mixin-imports.ts`、`Content/JavaScript/*.js` 是否入库以团队 `.gitignore` 策略为准；克隆后务必 `npm run gen:mixin-index` 再编译。
3. **插件**：`.uproject` 需启用 **Puerts** 与 **PuertsMixinAutomation**。
4. **评审**：新增全局消息、`BP_`/`TS_` 跨层接口、同步 Send、Tick 逻辑、碰撞例外修改须 Code Review。

---

*文档版本：与 PuertsDemo（UE 5.7）工程同步维护。*
