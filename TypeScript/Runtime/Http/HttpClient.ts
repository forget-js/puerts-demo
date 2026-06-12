/**
 * 项目 HTTP 客户端: 在 {@link HttpTransport} 之上封装 baseUrl、鉴权、重试、
 * 响应解析与取消语义. 业务代码应通过 Game/Services/Api 调用, 不直接使用 Transport.
 */

import { GF } from '../../Global';
import { getMixinRuntimeState } from '../MixinState';
import { HttpError } from './HttpError';
import { buildUrl, normalizeHeaders, parseResponseBody, serializeBody } from './Json';
import type {
    BearerTokenProvider,
    BearerTokenRefreshHandler,
    HttpHeaders,
    HttpMethod,
    HttpRequestOptions,
    HttpRetryOptions,
    HttpTask,
    HttpTransport,
    HttpTransportResponse,
    HttpTransportTask,
} from './types';

export interface HttpClientOptions {
    readonly transport: HttpTransport;
    readonly baseUrl?: string;
    readonly timeoutMs?: number;
    readonly defaultHeaders?: HttpHeaders;
    readonly retry?: Partial<HttpRetryOptions>;
    readonly bearerTokenProvider?: BearerTokenProvider;
    readonly bearerTokenRefreshHandler?: BearerTokenRefreshHandler;
}

const LOGGER = GF.CreateLogger('HttpClient');

/** 与 Config.http.retry 默认值对齐; 构造时可被 options.retry 覆盖. */
const DEFAULT_RETRY: HttpRetryOptions = {
    attempts: 1,
    baseDelayMs: 250,
    maxDelayMs: 2000,
    retryMethods: ['GET', 'HEAD'],
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

/** 可注入 Transport 的 HTTP 门面; 支持 Bearer 动态注入与 401 单次刷新. */
export class HttpClient {
    private readonly transport: HttpTransport;
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly defaultHeaders: HttpHeaders;
    private readonly retry: HttpRetryOptions;
    private bearerTokenProvider?: BearerTokenProvider;
    private bearerTokenRefreshHandler?: BearerTokenRefreshHandler;
    private refreshInFlight?: Promise<boolean>;

    constructor(options: HttpClientOptions) {
        this.transport = options.transport;
        this.baseUrl = options.baseUrl || '';
        this.timeoutMs = options.timeoutMs ?? 15000;
        this.defaultHeaders = normalizeHeaders(options.defaultHeaders);
        this.retry = {
            ...DEFAULT_RETRY,
            ...options.retry,
        };
        this.bearerTokenProvider = options.bearerTokenProvider;
        this.bearerTokenRefreshHandler = options.bearerTokenRefreshHandler;
    }

    setBearerTokenProvider(provider?: BearerTokenProvider): void {
        this.bearerTokenProvider = provider;
    }

    setBearerTokenRefreshHandler(handler?: BearerTokenRefreshHandler): void {
        this.bearerTokenRefreshHandler = handler;
    }

    /**
     * 发起请求并返回可取消的 {@link HttpTask}.
     * 传入 options.owner 时, 任务会登记到 Mixin 的 HttpRequestBag, EndPlay 时自动 cancel.
     */
    request<T = unknown>(options: HttpRequestOptions): HttpTask<T> {
        const method = options.method || 'GET';
        const url = buildUrl(this.baseUrl, options.url, options.query);
        const retry = this.resolveRetry(options.retry);
        let activeTask: HttpTransportTask | undefined;
        let canceled = false;
        let rejectTask: (error: unknown) => void = () => undefined;

        const promise = new Promise<T>((resolve, reject) => {
            rejectTask = reject;
            this.runRequest<T>(
                options,
                method,
                url,
                retry,
                () => activeTask,
                (task) => {
                    activeTask = task;
                },
                () => canceled
            ).then(resolve, reject);
        }) as HttpTask<T>;

        // Transport 异步启动, requestId 在 send 返回后才可用, 故用 getter 延迟读取.
        Object.defineProperty(promise, 'requestId', {
            get: () => activeTask?.requestId ?? 0,
        });

        promise.cancel = (reason = 'HTTP request canceled') => {
            if (canceled) {
                return;
            }

            canceled = true;
            activeTask?.cancel(reason);
            rejectTask(HttpError.canceled(reason));
        };

        if (options.owner) {
            getMixinRuntimeState(options.owner).requests.track(promise);
        }

        return promise;
    }

    get<T = unknown>(url: string, options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}): HttpTask<T> {
        return this.request<T>({ ...options, url, method: 'GET' });
    }

    post<T = unknown>(
        url: string,
        body?: unknown,
        options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}
    ): HttpTask<T> {
        return this.request<T>({ ...options, url, method: 'POST', body });
    }

    put<T = unknown>(
        url: string,
        body?: unknown,
        options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}
    ): HttpTask<T> {
        return this.request<T>({ ...options, url, method: 'PUT', body });
    }

    delete<T = unknown>(url: string, options: Omit<HttpRequestOptions, 'url' | 'method' | 'body'> = {}): HttpTask<T> {
        return this.request<T>({ ...options, url, method: 'DELETE' });
    }

    /** 带指数退避重试的执行循环; 401 刷新成功时不消耗重试次数 (--attempt). */
    private async runRequest<T>(
        options: HttpRequestOptions,
        method: HttpMethod,
        url: string,
        retry: HttpRetryOptions,
        getActiveTask: () => HttpTransportTask | undefined,
        setActiveTask: (task: HttpTransportTask) => void,
        isCanceled: () => boolean
    ): Promise<T> {
        let refreshedToken = false;
        let lastError: unknown;

        for (let attempt = 1; attempt <= retry.attempts; ++attempt) {
            if (isCanceled()) {
                throw HttpError.canceled();
            }

            try {
                const headers = await this.createHeaders(options);
                const body = serializeBody(options.body, headers);
                const transportTask = this.transport.send({
                    url,
                    method,
                    headers,
                    body,
                    timeoutMs: options.timeoutMs ?? this.timeoutMs,
                });
                setActiveTask(transportTask);

                const response = await transportTask.promise;
                return this.handleResponse<T>(response, method, url, options.responseType);
            } catch (error) {
                lastError = this.normalizeError(error, getActiveTask()?.requestId, method, url);

                if (isCanceled()) {
                    throw HttpError.canceled();
                }

                if (this.shouldRefreshToken(lastError, options, refreshedToken)) {
                    refreshedToken = true;
                    if (await this.tryRefreshToken()) {
                        --attempt;
                        continue;
                    }
                }

                if (!this.shouldRetry(lastError, method, attempt, retry)) {
                    throw lastError;
                }

                LOGGER.Warn('HTTP request retrying', {
                    context: {
                        requestId: getActiveTask()?.requestId,
                        method,
                        url,
                        attempt,
                        statusCode: lastError instanceof HttpError ? lastError.statusCode : undefined,
                    },
                    toScreen: false,
                });

                await delay(Math.min(retry.baseDelayMs * Math.pow(2, attempt - 1), retry.maxDelayMs));
            }
        }

        throw lastError;
    }

    /** 合并默认头、请求头, 并在未 skipAuth 时注入 Bearer token. */
    private async createHeaders(options: HttpRequestOptions): Promise<HttpHeaders> {
        const headers = {
            ...this.defaultHeaders,
            ...normalizeHeaders(options.headers),
        };

        if (!options.skipAuth && this.bearerTokenProvider) {
            const token = await this.bearerTokenProvider();
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /** 区分 Transport 失败、非 2xx 与成功响应, 并按 responseType 解析 body. */
    private handleResponse<T>(
        response: HttpTransportResponse,
        method: HttpMethod,
        url: string,
        responseType: HttpRequestOptions['responseType']
    ): T {
        if (response.canceled) {
            throw HttpError.canceled();
        }

        if (!response.succeeded) {
            throw new HttpError({
                kind: 'Transport',
                message: response.errorMessage || 'HTTP transport failed.',
                requestId: response.requestId,
                method,
                url,
                statusCode: response.statusCode,
                responseBody: response.body,
            });
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new HttpError({
                kind: 'StatusCode',
                message: `HTTP ${response.statusCode}`,
                requestId: response.requestId,
                method,
                url,
                statusCode: response.statusCode,
                responseBody: response.body,
            });
        }

        LOGGER.Verbose('HTTP request completed', {
            context: {
                requestId: response.requestId,
                method,
                url,
                statusCode: response.statusCode,
            },
            toScreen: false,
        });

        return parseResponseBody<T>(response, responseType);
    }

    /** 将 Transport 层抛出的裸 Error 统一包装为 {@link HttpError}, 并补全上下文. */
    private normalizeError(error: unknown, requestId: number | undefined, method: HttpMethod, url: string): unknown {
        if (error instanceof HttpError) {
            if (!error.method || !error.url || !error.requestId) {
                return new HttpError({
                    kind: error.kind,
                    message: error.message,
                    requestId: error.requestId || requestId,
                    method: error.method || method,
                    url: error.url || url,
                    statusCode: error.statusCode,
                    responseBody: error.responseBody,
                    cause: error.originalError,
                });
            }
            return error;
        }

        return new HttpError({
            kind: 'Transport',
            message: error instanceof Error ? error.message : 'HTTP request failed.',
            requestId,
            method,
            url,
            cause: error,
        });
    }

    private resolveRetry(retry: HttpRequestOptions['retry']): HttpRetryOptions {
        if (retry === false) {
            return {
                ...this.retry,
                attempts: 1,
            };
        }

        return {
            ...this.retry,
            ...retry,
            attempts: Math.max(1, retry?.attempts ?? this.retry.attempts),
        };
    }

    /** 并发 401 共享同一次 refresh, 避免多次刷新 token. */
    private tryRefreshToken(): Promise<boolean> {
        if (this.refreshInFlight) {
            return this.refreshInFlight;
        }

        if (!this.bearerTokenRefreshHandler) {
            return Promise.resolve(false);
        }

        this.refreshInFlight = Promise.resolve(this.bearerTokenRefreshHandler()).finally(() => {
            this.refreshInFlight = undefined;
        });
        return this.refreshInFlight;
    }

    /** 每个请求最多尝试一次 token 刷新, 避免 401 死循环. */
    private shouldRefreshToken(error: unknown, options: HttpRequestOptions, refreshedToken: boolean): boolean {
        return (
            !options.skipAuth &&
            !refreshedToken &&
            Boolean(this.bearerTokenRefreshHandler) &&
            error instanceof HttpError &&
            error.statusCode === 401
        );
    }

    /**
     * 重试策略: 仅对 retryMethods 中的动词生效; 取消与 JSON 解析错误不重试;
     * Transport 层失败一律重试; StatusCode 错误仅重试配置中的状态码.
     */
    private shouldRetry(error: unknown, method: HttpMethod, attempt: number, retry: HttpRetryOptions): boolean {
        if (attempt >= retry.attempts || !retry.retryMethods.includes(method)) {
            return false;
        }

        if (!(error instanceof HttpError)) {
            return true;
        }

        if (error.kind === 'Canceled' || error.kind === 'Parse') {
            return false;
        }

        if (error.kind === 'Transport') {
            return true;
        }

        return error.statusCode !== undefined && retry.retryStatusCodes.includes(error.statusCode);
    }
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
