/**
 * 测试域 Mock Transport 路由注册.
 *
 * 在 Mixin / 单测中: Api.setTransport(setupTestMockTransport()) 后再调用 Api.test.*.
 */

import { Config } from '../../Config/Config';
import { MockHttpTransport, type HttpTransportResponse } from '../../Runtime';
import { buildTestMockUrl, TestRoutes, type SaveTestItemRequestDto, type TestItemDto } from './test.api';

function mockJsonResponse(body: unknown, statusCode = 200): HttpTransportResponse {
    return {
        requestId: 0,
        statusCode,
        succeeded: true,
        canceled: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function parseJsonBody<T>(body?: string): T | undefined {
    if (!body) {
        return undefined;
    }

    try {
        return JSON.parse(body) as T;
    } catch {
        return undefined;
    }
}

/** Puerts 运行时可能无 URLSearchParams, 用手动解析 query. */
function parseQueryParam(url: string, key: string): string | undefined {
    const queryIndex = url.indexOf('?');
    if (queryIndex < 0) {
        return undefined;
    }

    const query = url.slice(queryIndex + 1);
    for (const segment of query.split('&')) {
        if (!segment) {
            continue;
        }

        const eqIndex = segment.indexOf('=');
        const paramKey = eqIndex >= 0 ? segment.slice(0, eqIndex) : segment;
        if (decodeURIComponent(paramKey) !== key) {
            continue;
        }

        const rawValue = eqIndex >= 0 ? segment.slice(eqIndex + 1) : '';
        return decodeURIComponent(rawValue.replace(/\+/g, ' '));
    }

    return undefined;
}

function parseItemIdFromUrl(url: string, basePath: string): string | undefined {
    const path = url.split('?')[0];
    const prefix = `${basePath}/`;
    if (!path.startsWith(prefix)) {
        return undefined;
    }

    const id = decodeURIComponent(path.slice(prefix.length));
    return id.length > 0 ? id : undefined;
}

export function setupTestMockTransport(): MockHttpTransport {
    const transport = new MockHttpTransport();
    const baseUrl = Config.http.baseUrl || 'https://api.example.com';
    const itemsBaseUrl = buildTestMockUrl(baseUrl, TestRoutes.items);
    const echoBaseUrl = buildTestMockUrl(baseUrl, TestRoutes.echo);

    transport.registerPath('GET', buildTestMockUrl(baseUrl, TestRoutes.ping), () =>
        mockJsonResponse({ ok: true, message: 'pong' })
    );

    transport.registerPath('GET', echoBaseUrl, (request) => {
        const name = parseQueryParam(request.url, 'name') || 'anonymous';
        return mockJsonResponse({
            name,
            greeting: `hello, ${name}`,
        });
    });

    transport.register('POST', itemsBaseUrl, (request) => {
        const body = parseJsonBody<SaveTestItemRequestDto>(request.body) ?? { name: 'unknown', quantity: 0 };
        const item: TestItemDto = {
            id: `item-${Date.now()}`,
            name: body.name,
            quantity: body.quantity,
        };
        return mockJsonResponse(item, 201);
    });

    transport.registerPath('PUT', itemsBaseUrl, (request) => {
        const id = parseItemIdFromUrl(request.url, itemsBaseUrl);
        const body = parseJsonBody<SaveTestItemRequestDto>(request.body) ?? { name: 'unknown', quantity: 0 };
        return mockJsonResponse({
            id: id || 'item-unknown',
            name: body.name,
            quantity: body.quantity,
        });
    });

    transport.registerPath('DELETE', itemsBaseUrl, (request) => {
        const id = parseItemIdFromUrl(request.url, itemsBaseUrl);
        return mockJsonResponse({
            deleted: true,
            id: id || 'item-unknown',
        });
    });

    return transport;
}
