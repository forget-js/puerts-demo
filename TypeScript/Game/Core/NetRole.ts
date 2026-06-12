/**
 * 从 GameInstance 解析脚本 NetRole, 用于 Mixin / Feature 分端加载.
 */

import { argv } from 'puerts';
import * as UE from 'ue';

export type ExecutionContext = 'Shared' | 'Client' | 'Server';

/** 对齐 UE ENetMode 数值 (Puerts 声明未导出 ENetMode 时使用). */
export const ScriptNetMode = {
    NM_Standalone: 0,
    NM_DedicatedServer: 1,
    NM_ListenServer: 2,
    NM_Client: 3,
} as const;

export type ScriptNetModeValue = (typeof ScriptNetMode)[keyof typeof ScriptNetMode];

/** 脚本启动时的网络角色快照. */
export type ScriptNetRole = {
    readonly loadClientMixins: boolean;
    readonly loadServerMixins: boolean;
    readonly loadSharedMixins: boolean;
    readonly netMode: ScriptNetModeValue;
};

let cachedRole: ScriptNetRole | undefined;

function readWorldNetMode(world: UE.World): ScriptNetModeValue {
    const getNetMode = (world as UE.World & { GetNetMode?: () => number }).GetNetMode;
    if (typeof getNetMode !== 'function') {
        return ScriptNetMode.NM_Standalone;
    }

    return getNetMode.call(world) as ScriptNetModeValue;
}

function resolveNetMode(gameInstance: UE.GameInstance | undefined): ScriptNetModeValue {
    const world = gameInstance?.GetWorld();
    if (!world) {
        return ScriptNetMode.NM_Standalone;
    }

    return readWorldNetMode(world);
}

/** 根据 ENetMode 计算应加载的 Mixin / Feature 上下文. */
export function resolveScriptNetRole(gameInstance?: UE.GameInstance): ScriptNetRole {
    if (cachedRole) {
        return cachedRole;
    }

    const resolvedInstance = gameInstance ?? (argv.getByName('GameInstance') as UE.GameInstance | undefined);
    const netMode = resolveNetMode(resolvedInstance);

    const loadClientMixins =
        netMode === ScriptNetMode.NM_Standalone ||
        netMode === ScriptNetMode.NM_Client ||
        netMode === ScriptNetMode.NM_ListenServer;
    const loadServerMixins =
        netMode === ScriptNetMode.NM_Standalone ||
        netMode === ScriptNetMode.NM_DedicatedServer ||
        netMode === ScriptNetMode.NM_ListenServer;

    cachedRole = {
        loadClientMixins,
        loadServerMixins,
        loadSharedMixins: true,
        netMode,
    };

    return cachedRole;
}

/** 重置缓存 (单测或热重载场景). */
export function resetScriptNetRoleCache(): void {
    cachedRole = undefined;
}

export function shouldLoadMixinContext(
    context: ExecutionContext,
    role: ScriptNetRole = resolveScriptNetRole()
): boolean {
    switch (context) {
        case 'Client':
            return role.loadClientMixins;
        case 'Server':
            return role.loadServerMixins;
        case 'Shared':
        default:
            return role.loadSharedMixins;
    }
}

export function shouldRunFeatureModule(
    context: ExecutionContext | undefined,
    role: ScriptNetRole = resolveScriptNetRole()
): boolean {
    if (!context || context === 'Shared') {
        return true;
    }

    return shouldLoadMixinContext(context, role);
}
