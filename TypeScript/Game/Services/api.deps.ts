import type { HttpRequestOptions, HttpTask } from '../../Runtime';

export type ApiRequestOptions = Omit<HttpRequestOptions, 'url' | 'method' | 'body'>;

/** 领域 *.api.ts 可使用的最小 HTTP 能力面 */
export interface ApiHttpDeps {
    get<T>(url: string, options?: ApiRequestOptions): HttpTask<T>;
    post<T>(url: string, body?: unknown, options?: ApiRequestOptions): HttpTask<T>;
    put<T>(url: string, body?: unknown, options?: ApiRequestOptions): HttpTask<T>;
    patch<T>(url: string, body?: unknown, options?: ApiRequestOptions): HttpTask<T>;
    delete<T>(url: string, options?: ApiRequestOptions): HttpTask<T>;
}
