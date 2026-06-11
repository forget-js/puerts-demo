/**
 * 游戏层 HTTP 业务入口 (HttpClient 壳).
 *
 * Mixin / UI 应调用 Api.test.* 等领域方法, 不直接拼 baseUrl 或使用 UnrealHttpTransport.
 * 领域 REST 见 *.api.ts; token 通过 setBearerTokenProvider 运行时注入, 不写入 Config.
 */

import { Config } from '../../Config/Config';
import { GF } from '../../Global';
import {
    HttpClient,
    UnrealHttpTransport,
    type BearerTokenProvider,
    type BearerTokenRefreshHandler,
    type GameModule,
    type HttpRequestOptions,
    type HttpTask,
    type HttpTransport,
} from '../../Runtime';
import type { ApiHttpDeps } from './api.deps';

/**
 * 导入业务领域 API 文件, 并创建对应的 API 实例.
 */
import { createTestApi } from './test.api';
import { createTestUserApi } from './testUser.api';

const LOGGER = GF.CreateLogger('ApiService');

class ApiService implements ApiHttpDeps {
    /**
     * 挂载业务领域 API, 每个 API 实例都依赖 ApiHttpDeps 契约.
     */
    readonly test = createTestApi(this);
    readonly testUser = createTestUserApi(this);

    private transport?: HttpTransport;
    private client?: HttpClient;
    private bearerTokenProvider?: BearerTokenProvider;
    private bearerTokenRefreshHandler?: BearerTokenRefreshHandler;

    /** 懒初始化 HttpClient; 重复调用无副作用. */
    init(): void {
        if (this.client) {
            return;
        }

        this.transport = this.transport || new UnrealHttpTransport();
        this.client = new HttpClient({
            transport: this.transport,
            baseUrl: Config.http.baseUrl,
            timeoutMs: Config.http.timeoutMs,
            defaultHeaders: Config.http.defaultHeaders,
            retry: Config.http.retry,
            bearerTokenProvider: this.bearerTokenProvider,
            bearerTokenRefreshHandler: this.bearerTokenRefreshHandler,
        });

        LOGGER.Log('API service initialized', {
            context: {
                baseUrl: Config.http.baseUrl || '(empty)',
                timeoutMs: Config.http.timeoutMs,
            },
            toScreen: false,
        });
    }

    /** 取消进行中的 Transport 请求并释放 client 引用. */
    dispose(): void {
        this.transport?.cancelAll?.();
        this.client = undefined;
        this.transport = undefined;
    }

    /** 替换 Transport (如单测注入 MockHttpTransport); 会 cancel 旧 Transport 上的未完成请求. */
    setTransport(transport: HttpTransport): void {
        this.transport?.cancelAll?.();
        this.transport = transport;
        this.client = undefined;
    }

    setBearerTokenProvider(provider?: BearerTokenProvider): void {
        this.bearerTokenProvider = provider;
        this.client?.setBearerTokenProvider(provider);
    }

    setBearerTokenRefreshHandler(handler?: BearerTokenRefreshHandler): void {
        this.bearerTokenRefreshHandler = handler;
        this.client?.setBearerTokenRefreshHandler(handler);
    }

    request<T = unknown>(options: HttpRequestOptions): HttpTask<T> {
        return this.getClient().request<T>(options);
    }

    get<T = unknown>(url: string, options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}): HttpTask<T> {
        return this.getClient().get<T>(url, options);
    }

    post<T = unknown>(
        url: string,
        body?: unknown,
        options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}
    ): HttpTask<T> {
        return this.getClient().post<T>(url, body, options);
    }

    put<T = unknown>(
        url: string,
        body?: unknown,
        options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}
    ): HttpTask<T> {
        return this.getClient().put<T>(url, body, options);
    }

    delete<T = unknown>(url: string, options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}): HttpTask<T> {
        return this.getClient().delete<T>(url, options);
    }

    private getClient(): HttpClient {
        if (!this.client) {
            this.init();
        }

        return this.client as HttpClient;
    }
}

export const Api = new ApiService();

export const ApiModule: GameModule = {
    name: 'Api',
    init(): void {
        Api.init();
    },
    dispose(): void {
        Api.dispose();
    },
};
