import type { HttpMethod } from './types';

/**
 * HTTP 错误分类.
 * - Transport: 网络/插件层失败
 * - StatusCode: 收到响应但 HTTP 状态非 2xx
 * - Canceled: 主动 cancel 或 owner 销毁
 * - Parse: 响应体 JSON 解析失败
 */
export type HttpErrorKind = 'Transport' | 'StatusCode' | 'Canceled' | 'Parse';

export interface HttpErrorOptions {
    readonly kind: HttpErrorKind;
    readonly message: string;
    readonly requestId?: number;
    readonly method?: HttpMethod;
    readonly url?: string;
    readonly statusCode?: number;
    readonly responseBody?: string;
    readonly cause?: unknown;
}

/** 携带请求上下文的结构化错误; responseBody 便于业务层解析服务端错误码. */
export class HttpError extends Error {
    readonly kind: HttpErrorKind;
    readonly requestId?: number;
    readonly method?: HttpMethod;
    readonly url?: string;
    readonly statusCode?: number;
    readonly responseBody?: string;
    readonly originalError?: unknown;

    constructor(options: HttpErrorOptions) {
        super(options.message);
        this.name = 'HttpError';
        this.kind = options.kind;
        this.requestId = options.requestId;
        this.method = options.method;
        this.url = options.url;
        this.statusCode = options.statusCode;
        this.responseBody = options.responseBody;
        this.originalError = options.cause;
    }

    static canceled(message = 'HTTP request canceled'): HttpError {
        return new HttpError({
            kind: 'Canceled',
            message,
        });
    }
}
