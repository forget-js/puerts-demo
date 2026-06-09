/**
 * Blueprint Catalog 运行时入口。
 *
 * 手写 Mixin / Game 代码只从这里加载蓝图类、获取类型和注册 mixin，
 * 避免在业务脚本中散落 `/Game/...` 路径与 UE 蓝图生成类型引用。
 */
import * as UE from 'ue';
import { blueprint } from 'puerts';
import {
    bindLogContext,
    registerLogContext,
    type RegisteredLogContext,
} from '../Global/Logger';
import {
    type BlueprintClass,
    type BlueprintDescriptor,
    type BlueprintInstance,
    type BlueprintSymbol,
} from './_generated/BlueprintCatalog';

export * from './_generated/BlueprintCatalog';
export type { BlueprintClass, BlueprintDescriptor, BlueprintInstance, BlueprintSymbol };

type BlueprintMixinConstructor<TInstance> = new (...args: any[]) => TInstance;
type BlueprintMixinPrototype = Record<string, unknown>;

const LOG_CONTEXT_WRAPPED = Symbol('LogContextWrapped');

function makeBlueprintLogContext(descriptor: BlueprintDescriptor): RegisteredLogContext {
    const displayName = descriptor.symbol.replace(/Blueprint$/, '');

    return {
        displayName,
        module: displayName,
    };
}

function wrapMixinMethodsWithLogContext(mixinClass: BlueprintMixinConstructor<unknown>, context: RegisteredLogContext): void {
    const prototype = mixinClass.prototype as BlueprintMixinPrototype;

    for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === 'constructor') {
            continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (!descriptor || typeof descriptor.value !== 'function') {
            continue;
        }

        const original = descriptor.value as Function & { [LOG_CONTEXT_WRAPPED]?: boolean };
        if (original[LOG_CONTEXT_WRAPPED]) {
            continue;
        }

        const wrapped = function (this: unknown, ...args: unknown[]) {
            bindLogContext(this, context);
            return original.apply(this, args);
        } as Function & { [LOG_CONTEXT_WRAPPED]?: boolean };
        wrapped[LOG_CONTEXT_WRAPPED] = true;

        Object.defineProperty(prototype, name, {
            ...descriptor,
            value: wrapped,
        });
    }
}

/** 按 Catalog 描述符加载 UE 蓝图生成类。 */
export function loadBlueprintClass<TDescriptor extends BlueprintDescriptor>(
    descriptor: TDescriptor
): UE.Class {
    const uclass = UE.Class.Load(descriptor.path);
    if (!uclass) {
        throw new Error(`Failed to load Blueprint class: ${descriptor.path}`);
    }

    return uclass;
}

/** 转换为 Puerts 可用于 `blueprint.mixin` 的 JS class。 */
export function toBlueprintJsClass<TDescriptor extends BlueprintDescriptor>(
    descriptor: TDescriptor
): BlueprintClass<TDescriptor> {
    return blueprint.tojs<BlueprintClass<TDescriptor>>(
        loadBlueprintClass(descriptor)
    ) as unknown as BlueprintClass<TDescriptor>;
}

/** 将 TS mixin class 绑定到指定蓝图生成类。 */
export function registerBlueprintMixin<TDescriptor extends BlueprintDescriptor>(
    descriptor: TDescriptor,
    mixinClass: BlueprintMixinConstructor<BlueprintInstance<TDescriptor>>
): void {
    const logContext = makeBlueprintLogContext(descriptor);
    registerLogContext(mixinClass, logContext);
    registerLogContext(mixinClass.prototype, logContext);
    wrapMixinMethodsWithLogContext(mixinClass, logContext);

    // Puerts 的 mixin 类型约束基于 InstanceType；这里由 Catalog 的 descriptor 保证两者对应。
    blueprint.mixin(toBlueprintJsClass(descriptor), mixinClass as any);
}
