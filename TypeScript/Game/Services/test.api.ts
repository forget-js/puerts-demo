/**
 * 测试域 REST API（Mock / 联调示例）.
 *
 * 覆盖: 无入参 GET、Query 入参 GET、POST/PUT body、DELETE path 入参.
 */

import type { HttpTask } from '../../Runtime';
import type { ApiHttpDeps, ApiRequestOptions } from './api.deps';

/** 测试域 REST 路径（相对 Config.http.baseUrl） */
const TestRoutes = {
    ping: '/test/ping',
    echo: '/test/echo',
    items: '/test/items',
    item: (id: string) => `/test/items/${encodeURIComponent(id)}`,
} as const;

/** GET /test/ping — 无入参 */
export interface PingResponseDto {
    readonly ok: boolean;
    readonly message: string;
}

/** GET /test/echo?name= — Query 入参 */
export interface EchoQueryResponseDto {
    readonly name: string;
    readonly greeting: string;
}

/** POST/PUT /test/items — 请求体 */
export interface SaveTestItemRequestDto {
    readonly name: string;
    readonly quantity: number;
}

/** POST/PUT 返回 */
export interface TestItemDto {
    readonly id: string;
    readonly name: string;
    readonly quantity: number;
}

/** DELETE /test/items/:id — 仅 path 入参 */
export interface DeleteTestItemResponseDto {
    readonly deleted: boolean;
    readonly id: string;
}

export interface TestApi {
    ping(options?: ApiRequestOptions): HttpTask<PingResponseDto>;
    echoQuery(name: string, options?: ApiRequestOptions): HttpTask<EchoQueryResponseDto>;
    createItem(body: SaveTestItemRequestDto, options?: ApiRequestOptions): HttpTask<TestItemDto>;
    updateItem(id: string, body: SaveTestItemRequestDto, options?: ApiRequestOptions): HttpTask<TestItemDto>;
    deleteItem(id: string, options?: ApiRequestOptions): HttpTask<DeleteTestItemResponseDto>;
}

export function createTestApi(deps: ApiHttpDeps): TestApi {
    return {
        ping: (options = {}) => deps.get<PingResponseDto>(TestRoutes.ping, options),

        echoQuery: (name, options = {}) =>
            deps.get<EchoQueryResponseDto>(TestRoutes.echo, {
                ...options,
                query: { ...options.query, name },
            }),

        createItem: (body, options = {}) => deps.post<TestItemDto>(TestRoutes.items, body, options),

        updateItem: (id, body, options = {}) => deps.put<TestItemDto>(TestRoutes.item(id), body, options),

        deleteItem: (id, options = {}) => deps.delete<DeleteTestItemResponseDto>(TestRoutes.item(id), options),
    };
}

/** 供 test.mock.ts 拼接 Mock 路由用 */
export function buildTestMockUrl(baseUrl: string, path: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export { TestRoutes };
