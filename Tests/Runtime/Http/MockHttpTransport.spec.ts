/**
 * MockHttpTransport 契约测试.
 *
 * Mock Transport 用于单元测试与离线调试, 行为必须尽量贴近 UnrealHttpTransport:
 * 异步 resolve、path 匹配、单请求取消与 cancelAll 都要明确 settle.
 */
import { describe, expect, it } from 'vitest';

import { HttpError, MockHttpTransport } from '../../../TypeScript/Runtime/Http';

describe('MockHttpTransport', () => {
    it('matches registered path prefixes without query string', async () => {
        const transport = new MockHttpTransport();
        transport.registerPath('GET', 'https://example.test/users', (request) => ({
            requestId: 0,
            statusCode: 200,
            succeeded: true,
            canceled: false,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: request.url }),
        }));

        await expect(
            transport.send({
                url: 'https://example.test/users/alice?verbose=true',
                method: 'GET',
                headers: {},
                timeoutMs: 1000,
            }).promise
        ).resolves.toMatchObject({
            statusCode: 200,
            body: JSON.stringify({ url: 'https://example.test/users/alice?verbose=true' }),
        });
    });

    it('rejects pending request as Canceled when task is canceled', async () => {
        const transport = new MockHttpTransport();
        const task = transport.send({
            url: 'https://example.test/slow',
            method: 'GET',
            headers: {},
            timeoutMs: 1000,
        });

        task.cancel('unit test cancel');

        await expect(task.promise).rejects.toMatchObject({
            name: 'HttpError',
            kind: 'Canceled',
            message: 'unit test cancel',
        } satisfies Partial<HttpError>);
    });

    it('rejects all pending requests when cancelAll is called', async () => {
        const transport = new MockHttpTransport();
        const first = transport.send({
            url: 'https://example.test/first',
            method: 'GET',
            headers: {},
            timeoutMs: 1000,
        });
        const second = transport.send({
            url: 'https://example.test/second',
            method: 'GET',
            headers: {},
            timeoutMs: 1000,
        });

        transport.cancelAll();

        // cancelAll 是本轮修复重点: 不能只清 timer, 必须让所有 Promise 进入 rejected 状态.
        await expect(first.promise).rejects.toMatchObject({ kind: 'Canceled' });
        await expect(second.promise).rejects.toMatchObject({ kind: 'Canceled' });
    });
});
