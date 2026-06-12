# Mixin Review Checklist

新增或修改 Puerts Blueprint Mixin 时，至少检查以下事项：

1. 这个蓝图确实需要 TypeScript 接管逻辑；纯表现、装饰、数据承载蓝图不创建 Mixin。
2. Mixin 文件名、Mixin 类名、Catalog 符号与蓝图当前名称一对一，例如 `BP_Foo.ts` / `BP_FooMixin` / `BP_FooBlueprint`。
3. 手写代码不直接写 `/Game/...`、`UE.Class.Load()` 或蓝图生成类型命名空间；蓝图加载和类型引用统一走 `TypeScript/Blueprints`。
4. Mixin 使用 `registerBlueprintMixin(XxxBlueprint, XxxMixin)`，类型使用 `BlueprintInstance<typeof XxxBlueprint>`。
5. `blueprint-manifest.json`、`BlueprintCatalog.ts`、`mixin-imports.ts` 与当前 Mixin 文件同步；新增、移动或重命名后运行 `npm run check`。
6. 不依赖 TS class 字段初始化或 `constructor`；实例运行时状态使用 `getMixinRuntimeState(this)`。
7. 状态归属清晰：策划配置放蓝图 `bp_` 变量，TS 临时状态放 `MixinRuntimeState`，模块常量/类型声明才放模块顶层。
8. 没有在模块顶层用 `WeakMap` / `Map` / 游离变量保存实例运行时状态。
9. 使用 `getMixinRuntimeState(this)` 时，必须在 `ReceiveEndPlay` 或 Widget `Destruct` 中调用 `clearMixinRuntimeState(this)`（`npm run check:mixin` 会校验配对）。
10. 实现 `ReceiveBeginPlay` 时，相关资源能在 `ReceiveEndPlay` / `Destruct` 中释放；关卡切换与脚本退出另有 `clearAllMixinRuntimeStates` 兜底，不能替代 EndPlay 清理。
11. 生命周期内火-and-forget 的 `async` 逻辑，若 `await` 后访问 `this`，使用 `runSafelyAsync` + `guardOwnerAsync`（见 CodeFormat 4.3.1）；`scope` 使用 `类名.方法名`。
12. 跨蓝图 `loadBlueprintClass` 延迟到使用点懒加载，禁止模块顶层调用（`Blueprints/index.ts` 已有路径级缓存）。
13. 委托绑定使用 `getMixinRuntimeState(this).delegates` 或保存同一个回调引用，避免无法 `Remove`。
14. 定时器使用 `getMixinRuntimeState(this).timers` 管理，禁止散落多个裸 timer id。
15. 默认不实现 `ReceiveTick`；确实需要 Tick 时说明原因、性能影响与状态初始化方式。
16. `ReceiveTick` 及其调用链只读取已初始化状态；状态缺失时返回或报错，不在 Tick 中懒创建业务状态。
17. 业务层优先使用 `GF` / `GE`、私有方法、项目封装和蓝图 `BP_` 函数，不散落直接调用高风险 UE API。
18. Mixin 中不直接调用 `K2_`、带 `$ref` / out 参数、多个 boolean、Latent / WorldContext、Spawn / Destroy / Attach / 位移 / 碰撞等高风险 UE API；确需例外时必须评审说明，能复用则先补 `GF` 封装。
19. 低风险只读或构造类 UE API 可直接使用，如 `GetName()`、简单判断、`new UE.Vector(...)`。
20. TS 触发表现只调用蓝图 `BP_` 函数，蓝图进入 TS 统一使用 `TS_` 入口。
21. 不直接调用动画、粒子、音效、UMG 动效等表现 API；表现细节留在蓝图。
22. 日志使用 `GF.Log` / `GF.Warn` / `GF.Error`，Mixin 模块名前缀自动推导，避免裸 `console.*`。
