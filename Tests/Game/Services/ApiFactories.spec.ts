/**
 * Game/Services API 工厂测试.
 *
 * 这些测试只验证领域 API 是否把 path / query / body 正确转交给 ApiHttpDeps,
 * 不触发真实 HttpClient 或 UE Transport, 便于在 Node 环境快速回归接口契约.
 */
import { describe, expect, it, vi } from 'vitest';

import type { HttpTask } from '../../../TypeScript/Runtime';
import type { ApiHttpDeps, ApiRequestOptions } from '../../../TypeScript/Game/Services/api.deps';
import { createTestApi } from '../../../TypeScript/Game/Services/test.api';
import { createTestUserApi } from '../../../TypeScript/Game/Services/testUser.api';

function task<T>(value: T): HttpTask<T> {
    const promise = Promise.resolve(value) as HttpTask<T>;
    Object.defineProperty(promise, 'requestId', {
        get: () => 1,
    });
    promise.cancel = () => undefined;
    return promise;
}

/** 构造最小 HttpTask, 让领域 API 工厂测试保持在纯 TypeScript 层. */
function createDeps(): ApiHttpDeps {
    return {
        get: createGetLikeMock(),
        post: createBodyLikeMock(),
        put: createBodyLikeMock(),
        patch: createBodyLikeMock(),
        delete: createGetLikeMock(),
    };
}

function createGetLikeMock(): ApiHttpDeps['get'] {
    const mock = vi.fn((...args: [string, ApiRequestOptions?]) => {
        void args;
        return task({});
    });
    // vi.fn 的泛型返回值会收窄为 unknown, 这里显式恢复 ApiHttpDeps 的泛型方法签名.
    return mock as unknown as ApiHttpDeps['get'];
}

function createBodyLikeMock(): ApiHttpDeps['post'] {
    const mock = vi.fn((...args: [string, unknown?, ApiRequestOptions?]) => {
        void args;
        return task({});
    });
    // post / put / patch 同签名, 共享一个 body 类 mock 即可验证调用参数.
    return mock as unknown as ApiHttpDeps['post'];
}

describe('API factories', () => {
    it('builds test API query and body requests through ApiHttpDeps', () => {
        const deps = createDeps();
        const api = createTestApi(deps);

        void api.echoQuery('Cube', { owner: {} });
        expect(deps.get).toHaveBeenCalledWith('/test/echo', {
            owner: {},
            query: { name: 'Cube' },
        });

        void api.createItem({ name: 'Sword', quantity: 1 });
        expect(deps.post).toHaveBeenCalledWith('/test/items', { name: 'Sword', quantity: 1 }, {});

        void deps.patch('/test/items/item-1', { quantity: 2 });
        expect(deps.patch).toHaveBeenCalledWith('/test/items/item-1', { quantity: 2 });
    });

    it('encodes testUser path parameters', () => {
        const deps = createDeps();
        const api = createTestUserApi(deps);

        void api.getUserByName('Cone Demo');
        expect(deps.get).toHaveBeenCalledWith('/users/Cone%20Demo', {});

        void api.updateUser('Cone Demo', { firstName: 'Cone' });
        expect(deps.put).toHaveBeenCalledWith('/users/Cone%20Demo', { firstName: 'Cone' }, {});
    });
});
