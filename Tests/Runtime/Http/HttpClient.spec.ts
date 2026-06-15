/**
 * HttpClient 契约测试.
 *
 * 使用 MockHttpTransport 在 Node 环境验证 Runtime HTTP 层的核心行为:
 * 状态码映射、重试策略、取消语义、401 共享刷新、owner 请求追踪与诊断 hooks.
 */
import { describe, expect, it, vi } from 'vitest';

import { clearMixinRuntimeState, getMixinRuntimeState } from '../../../TypeScript/Runtime';
import { HttpClient, HttpError, MockHttpTransport, type HttpTransportResponse } from '../../../TypeScript/Runtime/Http';

function jsonResponse(body: unknown, overrides: Partial<HttpTransportResponse> = {}): HttpTransportResponse {
    return {
        requestId: 0,
        statusCode: 200,
        succeeded: true,
        canceled: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...overrides,
    };
}

describe('HttpClient', () => {
    it('parses successful JSON responses', async () => {
        const transport = new MockHttpTransport();
        transport.register('GET', 'https://api.example.test/ping', () => jsonResponse({ ok: true }));
        const client = new HttpClient({ transport, baseUrl: 'https://api.example.test' });

        await expect(client.get<{ ok: boolean }>('/ping')).resolves.toEqual({ ok: true });
    });

    it('maps non-2xx responses to StatusCode HttpError', async () => {
        const transport = new MockHttpTransport();
        transport.register('GET', 'https://api.example.test/fail', () =>
            jsonResponse({ message: 'server error' }, { statusCode: 500 })
        );
        const client = new HttpClient({ transport, baseUrl: 'https://api.example.test' });

        await expect(client.get('/fail')).rejects.toMatchObject({
            name: 'HttpError',
            kind: 'StatusCode',
            statusCode: 500,
        } satisfies Partial<HttpError>);
    });

    it('retries configured GET failures and then returns the successful response', async () => {
        const transport = new MockHttpTransport();
        const handler = vi.fn(() =>
            // 第一次返回 500, 第二次成功, 用来验证 GET 重试闭环.
            handler.mock.calls.length === 1
                ? jsonResponse({ message: 'temporary' }, { statusCode: 500 })
                : jsonResponse({ ok: true })
        );
        transport.register('GET', 'https://api.example.test/retry', handler);
        const client = new HttpClient({
            transport,
            baseUrl: 'https://api.example.test',
            retry: { attempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
        });

        await expect(client.get('/retry')).resolves.toEqual({ ok: true });
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('does not retry POST by default', async () => {
        const transport = new MockHttpTransport();
        const handler = vi.fn(() => jsonResponse({ message: 'server error' }, { statusCode: 500 }));
        transport.register('POST', 'https://api.example.test/items', handler);
        const client = new HttpClient({
            transport,
            baseUrl: 'https://api.example.test',
            retry: { attempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
        });

        await expect(client.post('/items', { name: 'Sword' })).rejects.toMatchObject({ kind: 'StatusCode' });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('supports PATCH requests', async () => {
        const transport = new MockHttpTransport();
        transport.register('PATCH', 'https://api.example.test/items/1', (request) =>
            jsonResponse({ body: request.body })
        );
        const client = new HttpClient({ transport, baseUrl: 'https://api.example.test' });

        await expect(client.patch('/items/1', { name: 'Shield' })).resolves.toEqual({
            body: JSON.stringify({ name: 'Shield' }),
        });
    });

    it('emits lifecycle hooks without affecting request results', async () => {
        const transport = new MockHttpTransport();
        transport.register('GET', 'https://api.example.test/hooks', () => jsonResponse({ ok: true }));
        const onRequest = vi.fn();
        const onResponse = vi.fn(() => {
            // hooks 只用于诊断, 即使自身抛错也不能改变请求结果.
            throw new Error('hook failure should not fail request');
        });
        const client = new HttpClient({
            transport,
            baseUrl: 'https://api.example.test',
            hooks: {
                onRequest,
                onResponse,
            },
        });

        await expect(client.get('/hooks')).resolves.toEqual({ ok: true });
        expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', attempt: 1 }));
        expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 200 }));
    });

    it('shares one token refresh for concurrent 401 responses', async () => {
        const transport = new MockHttpTransport();
        let token = 'expired';
        const refreshToken = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            token = 'fresh';
            return true;
        });

        transport.register('GET', 'https://api.example.test/me', (request) => {
            // 两个并发请求先拿 expired token 触发 401, refresh 完成后共享 fresh token 重试.
            if (request.headers.Authorization === 'Bearer fresh') {
                return jsonResponse({ name: 'player' });
            }

            return jsonResponse({ message: 'unauthorized' }, { statusCode: 401 });
        });

        const client = new HttpClient({
            transport,
            baseUrl: 'https://api.example.test',
            bearerTokenProvider: () => token,
            bearerTokenRefreshHandler: refreshToken,
        });

        await expect(Promise.all([client.get('/me'), client.get('/me')])).resolves.toEqual([
            { name: 'player' },
            { name: 'player' },
        ]);
        expect(refreshToken).toHaveBeenCalledTimes(1);
    });

    it('rejects as Canceled when HttpTask is canceled', async () => {
        const transport = new MockHttpTransport();
        const client = new HttpClient({ transport, baseUrl: 'https://api.example.test' });
        const task = client.get('/slow');

        task.cancel('owner disposed');

        await expect(task).rejects.toMatchObject({
            kind: 'Canceled',
            message: 'owner disposed',
        } satisfies Partial<HttpError>);
    });

    it('tracks owner requests and removes them after completion', async () => {
        const transport = new MockHttpTransport();
        transport.register('GET', 'https://api.example.test/owner', () => jsonResponse({ ok: true }));
        const client = new HttpClient({ transport, baseUrl: 'https://api.example.test' });
        // 模拟 Puerts UObject 的稳定路径 key, 触发 MixinState 的 owner 请求追踪分支.
        const owner = { GetPathName: () => 'Tests.Owner' };

        const task = client.get('/owner', { owner });
        expect(getMixinRuntimeState(owner).requests.size).toBe(1);

        await expect(task).resolves.toEqual({ ok: true });
        expect(getMixinRuntimeState(owner).requests.size).toBe(0);
        clearMixinRuntimeState(owner);
    });
});
