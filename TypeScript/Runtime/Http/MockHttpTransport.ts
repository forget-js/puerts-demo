/**
 * 内存中的 {@link HttpTransport} 实现, 用于单元测试或离线调试.
 *
 * 通过 register(method, url, handler) 注册路由; 未匹配路由返回 404 JSON.
 * setTimeout(0) 模拟异步 Transport, 便于与真实回调时序对齐.
 */

import type {
    HttpHeaders,
    HttpTransport,
    HttpTransportRequest,
    HttpTransportResponse,
    HttpTransportTask,
} from './types';
import { HttpError } from './HttpError';

export type MockHttpHandler = (request: HttpTransportRequest) => HttpTransportResponse | Promise<HttpTransportResponse>;

interface MockRoute {
    readonly method: string;
    readonly url: string;
    readonly matchPathPrefix?: boolean;
    readonly handler: MockHttpHandler;
}

interface PendingMockTask {
    timer: ReturnType<typeof setTimeout>;
    reject(error: unknown): void;
}

export class MockHttpTransport implements HttpTransport {
    private nextRequestId = 1;
    private readonly routes: MockRoute[] = [];
    private readonly pendingTasks = new Map<number, PendingMockTask>();

    /** 按 method + 完整 url 精确匹配 handler. */
    register(method: string, url: string, handler: MockHttpHandler): void {
        this.routes.push({
            method: method.toUpperCase(),
            url,
            handler,
        });
    }

    /** 按 method + path 匹配; 忽略 query string, path 可带子路径 (如 /test/items/:id). */
    registerPath(method: string, urlPrefix: string, handler: MockHttpHandler): void {
        this.routes.push({
            method: method.toUpperCase(),
            url: urlPrefix,
            matchPathPrefix: true,
            handler,
        });
    }

    send(request: HttpTransportRequest): HttpTransportTask {
        const requestId = this.nextRequestId++;
        let rejectTask: (error: unknown) => void = () => undefined;

        const promise = new Promise<HttpTransportResponse>((resolve, reject) => {
            rejectTask = reject;
            const timer = setTimeout(() => {
                this.pendingTasks.delete(requestId);
                this.resolveMockRequest(requestId, request).then(resolve, reject);
            }, 0);

            this.pendingTasks.set(requestId, {
                timer,
                reject,
            });
        });

        return {
            requestId,
            promise,
            cancel: (reason = 'Mock HTTP request canceled') => {
                const task = this.pendingTasks.get(requestId);
                if (!task) {
                    return;
                }

                this.pendingTasks.delete(requestId);
                clearTimeout(task.timer);
                rejectTask(HttpError.canceled(reason));
            },
        };
    }

    cancelAll(): void {
        const tasks = Array.from(this.pendingTasks.entries());
        this.pendingTasks.clear();

        for (const [, task] of tasks) {
            // Mock 也要和真实 Transport 一样主动 reject, 这样单测能覆盖取消契约.
            clearTimeout(task.timer);
            task.reject(HttpError.canceled('Mock HTTP transport canceled all pending requests'));
        }
    }

    private async resolveMockRequest(requestId: number, request: HttpTransportRequest): Promise<HttpTransportResponse> {
        const route = this.routes.find((candidate) => this.matchesRoute(candidate, request));

        if (!route) {
            return {
                requestId,
                statusCode: 404,
                succeeded: true,
                canceled: false,
                headers: jsonHeaders(),
                body: JSON.stringify({ message: `No mock route for ${request.method} ${request.url}` }),
            };
        }

        const response = await route.handler(request);
        return {
            ...response,
            requestId,
        };
    }

    private matchesRoute(route: MockRoute, request: HttpTransportRequest): boolean {
        if (route.method !== request.method) {
            return false;
        }

        if (route.matchPathPrefix) {
            const requestPath = request.url.split('?')[0];
            return requestPath === route.url || requestPath.startsWith(`${route.url}/`);
        }

        return route.url === request.url;
    }
}

function jsonHeaders(): HttpHeaders {
    return {
        'Content-Type': 'application/json',
    };
}
