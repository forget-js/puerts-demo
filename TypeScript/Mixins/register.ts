/**
 * Mixin 副作用注册入口.
 *
 * 由 Bootstrap require 加载; 按 NetRole 分端引入 _generated/mixin-imports.*.
 * 勿手改 mixin-imports.*.ts; 新增 Mixin 后执行 npm run check.
 */
import { resolveScriptNetRole, shouldLoadMixinContext } from '../Game/Core/NetRole';

declare const require: (moduleName: string) => unknown;

const role = resolveScriptNetRole();

if (shouldLoadMixinContext('Shared', role)) {
    require('./_generated/mixin-imports.shared');
}
if (shouldLoadMixinContext('Client', role)) {
    require('./_generated/mixin-imports.client');
}
if (shouldLoadMixinContext('Server', role)) {
    require('./_generated/mixin-imports.server');
}
