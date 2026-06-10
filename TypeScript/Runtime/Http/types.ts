/**
 * HTTP 模块类型契约.
 *
 * 分层约定:
 * - {@link HttpRequestOptions} / {@link HttpTask}: HttpClient 对外 API
 * - {@link HttpTransportRequest} / {@link HttpTransportResponse}: Transport 层原始往返
 * - {@link HttpTransport}: 可替换实现 (Unreal / Mock)
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export type HttpHeaders = Record<string, string>;

export type HttpQueryValue = string | number | boolean | null | undefined;

export type HttpQuery = Record<string, HttpQueryValue>;

/** 默认按 JSON 解析; 'text' 返回字符串; 'raw' 返回完整 Transport 响应. */
export type HttpResponseType = 'json' | 'text' | 'raw';

export interface HttpRetryOptions {
    readonly attempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly retryMethods: readonly HttpMethod[];
    readonly retryStatusCodes: readonly number[];
}

export interface HttpRequestOptions {
    readonly url: string;
    readonly method?: HttpMethod;
    readonly headers?: HttpHeaders;
    readonly query?: HttpQuery;
    readonly body?: unknown;
    readonly timeoutMs?: number;
    /** 传 false 禁用重试 (attempts 强制为 1). */
    readonly retry?: Partial<HttpRetryOptions> | false;
    readonly responseType?: HttpResponseType;
    /** Mixin 实例 (一般为 this); 用于 EndPlay 时自动取消未完成请求. */
    readonly owner?: object;
    /** 为 true 时不注入 Bearer, 也不触发 401 刷新. */
    readonly skipAuth?: boolean;
}

/** 传给 Transport 的已序列化请求 (body 已为字符串). */
export interface HttpTransportRequest {
    readonly url: string;
    readonly method: HttpMethod;
    readonly headers: HttpHeaders;
    readonly body?: string;
    readonly timeoutMs: number;
}

/** Transport 层原始响应; statusCode 非 2xx 时 succeeded 仍可能为 true. */
export interface HttpTransportResponse {
    readonly requestId: number;
    readonly statusCode: number;
    readonly succeeded: boolean;
    readonly canceled: boolean;
    readonly errorMessage?: string;
    readonly headers: HttpHeaders;
    readonly body: string;
}

export interface HttpTransportTask {
    readonly requestId: number;
    readonly promise: Promise<HttpTransportResponse>;
    cancel(reason?: string): void;
}

/** 扩展 Promise: 附带 requestId 与 cancel, 供 HttpRequestBag 追踪. */
export interface HttpTask<T> extends Promise<T> {
    readonly requestId: number;
    cancel(reason?: string): void;
}

export interface HttpTransport {
    send(request: HttpTransportRequest): HttpTransportTask;
    cancelAll?(): void;
}

/** 动态提供 access token; 返回空则不发 Authorization 头. */
export type BearerTokenProvider = () => string | undefined | Promise<string | undefined>;

/** 401 时调用; 返回 true 表示刷新成功, HttpClient 会用新 token 重试同一请求. */
export type BearerTokenRefreshHandler = () => boolean | Promise<boolean>;
