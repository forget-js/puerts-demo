# Mixin Review Checklist

新增或修改 Puerts Blueprint Mixin 时，至少检查以下事项：

1. 这个蓝图确实需要 TypeScript 接管逻辑；纯表现、装饰、数据承载蓝图不创建 Mixin。
2. `UE.Class.Load()` 路径与 `TypeScript/Mixins/Blueprints/**` 文件路径一致。
3. 实现 `ReceiveBeginPlay` 时，相关资源能在 `ReceiveEndPlay` 中释放。
4. 不依赖 TS class 字段初始化或 constructor；Puerts Mixin 对象状态使用 `getMixinRuntimeState(this)`。
5. 委托绑定使用 `getMixinRuntimeState(this).delegates` 或保存同一个回调引用，避免无法 `Remove`。
6. 定时器使用 `getMixinRuntimeState(this).timers` 管理，禁止散落多个裸 timer id。
7. 默认不实现 `ReceiveTick`；确实需要 Tick 时说明原因和性能影响。
8. TS 触发表现只调用蓝图 `BP_` 函数，蓝图进入 TS 统一使用 `TS_` 入口。
9. 日志使用 `GF.Log` 并带清晰 module 名，避免裸 `console.log`。
10. 不直接调用动画、粒子、音效等表现 API；表现细节留在蓝图。
11. 新增或移动 Mixin 后运行 `npm run check`。
