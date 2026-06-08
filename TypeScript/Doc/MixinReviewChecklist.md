# Mixin Review Checklist

新增或修改 Puerts Blueprint Mixin 时，至少检查以下事项：

1. 这个蓝图确实需要 TypeScript 接管逻辑；纯表现、装饰、数据承载蓝图不创建 Mixin。
2. `UE.Class.Load()` 路径与 `TypeScript/Mixins/Blueprints/**` 文件路径一致。
3. 不依赖 TS class 字段初始化或 `constructor`；实例运行时状态使用 `getMixinRuntimeState(this)`。
4. 状态归属清晰：策划配置放蓝图 `bp_` 变量，TS 临时状态放 `MixinRuntimeState`，模块常量/类型声明才放模块顶层。
5. 没有在模块顶层用 `WeakMap` / `Map` / 游离变量保存实例运行时状态。
6. 实现 `ReceiveBeginPlay` 时，相关资源能在 `ReceiveEndPlay` 中释放。
7. 委托绑定使用 `getMixinRuntimeState(this).delegates` 或保存同一个回调引用，避免无法 `Remove`。
8. 定时器使用 `getMixinRuntimeState(this).timers` 管理，禁止散落多个裸 timer id。
9. 默认不实现 `ReceiveTick`；确实需要 Tick 时说明原因、性能影响与状态初始化方式。
10. `ReceiveTick` 及其调用链只读取已初始化状态；状态缺失时返回或报错，不在 Tick 中懒创建业务状态。
11. 业务层优先使用 `GF` / `GE`、私有方法、项目封装和蓝图 `BP_` 函数，不散落直接调用高风险 UE API。
12. Mixin 中不直接调用 `K2_`、带 `$ref` / out 参数、多个 boolean、Latent / WorldContext、Spawn / Destroy / Attach / 位移 / 碰撞等高风险 UE API；确需例外时必须评审说明，能复用则先补 `GF` 封装。
13. 低风险只读或构造类 UE API 可直接使用，如 `GetName()`、简单判断、`new UE.Vector(...)`。
14. TS 触发表现只调用蓝图 `BP_` 函数，蓝图进入 TS 统一使用 `TS_` 入口。
15. 不直接调用动画、粒子、音效、UMG 动效等表现 API；表现细节留在蓝图。
16. 日志使用 `GF.Log` 并带清晰 module 名，避免裸 `console.log`。
17. 新增或移动 Mixin 后运行 `npm run check`。
