/**
 * URL 拼接、请求体序列化与响应解析工具.
 *
 * 与 C++ 层 FPuertsHttpRequestOptions.HeadersJson 使用相同 JSON 对象格式.
 */

import type { HttpHeaders, HttpQuery, HttpResponseType, HttpTransportResponse } from './types';
import { HttpError } from './HttpError';

const JSON_CONTENT_TYPE = 'application/json';

export function normalizeHeaders(headers: HttpHeaders = {}): HttpHeaders {
    const normalized: HttpHeaders = {};
    for (const key of Object.keys(headers)) {
        const value = headers[key];
        if (value !== undefined) {
            normalized[key] = String(value);
        }
    }
    return normalized;
}

/** 相对 url 与 baseUrl 拼接; 绝对 url (http/https) 忽略 baseUrl. */
export function buildUrl(baseUrl: string, url: string, query?: HttpQuery): string {
    const fullUrl = /^https?:\/\//i.test(url) ? url : `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;

    if (!query) {
        return fullUrl;
    }

    const queryParts: string[] = [];
    for (const key of Object.keys(query)) {
        const value = query[key];
        if (value === undefined || value === null) {
            continue;
        }

        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }

    if (queryParts.length === 0) {
        return fullUrl;
    }

    return `${fullUrl}${fullUrl.indexOf('?') >= 0 ? '&' : '?'}${queryParts.join('&')}`;
}

/** 对象 body 自动 JSON 序列化并补 Content-Type; 字符串 body 原样发送. */
export function serializeBody(body: unknown, headers: HttpHeaders): string | undefined {
    if (body === undefined || body === null) {
        return undefined;
    }

    if (typeof body === 'string') {
        return body;
    }

    if (!findHeader(headers, 'content-type')) {
        headers['Content-Type'] = JSON_CONTENT_TYPE;
    }

    return JSON.stringify(body);
}

/** 解析 C++ 层 HeadersJson; 非字符串字段会被忽略. */
export function parseHeadersJson(headersJson?: string): HttpHeaders {
    if (!headersJson) {
        return {};
    }

    try {
        const parsed = JSON.parse(headersJson) as Record<string, unknown>;
        const headers: HttpHeaders = {};
        for (const key of Object.keys(parsed)) {
            const value = parsed[key];
            if (typeof value === 'string') {
                headers[key] = value;
            }
        }
        return headers;
    } catch {
        return {};
    }
}

/**
 * 按 responseType 解析响应体.
 * 未指定 type 时: Content-Type 含 json 或 body 以 [/{ 开头则 JSON.parse, 否则返回原始字符串.
 */
export function parseResponseBody<T>(response: HttpTransportResponse, responseType?: HttpResponseType): T {
    if (responseType === 'raw') {
        return response as unknown as T;
    }

    if (responseType === 'text') {
        return response.body as unknown as T;
    }

    if (response.body.length === 0) {
        return undefined as unknown as T;
    }

    const contentType = findHeader(response.headers, 'content-type');
    const looksLikeJson = /^[\s]*[[{]/.test(response.body);
    if (!contentType?.toLowerCase().includes(JSON_CONTENT_TYPE) && !looksLikeJson) {
        return response.body as unknown as T;
    }

    try {
        return JSON.parse(response.body) as T;
    } catch (error) {
        throw new HttpError({
            kind: 'Parse',
            message: 'Failed to parse HTTP response JSON.',
            requestId: response.requestId,
            statusCode: response.statusCode,
            responseBody: response.body,
            cause: error,
        });
    }
}

function findHeader(headers: HttpHeaders, name: string): string | undefined {
    const target = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === target) {
            return headers[key];
        }
    }
    return undefined;
}
