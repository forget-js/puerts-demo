/**
 * PuertsHttpTransport 插件的 TypeScript 适配层.
 *
 * 将 {@link HttpTransportRequest} 映射为 UE.UPuertsHttpClient.Send 调用,
 * 回调中把 FPuertsHttpResponse 转回统一的 {@link HttpTransportResponse}.
 * 需在 Unreal 编译插件并重新生成 Puerts d.ts 后 UE.PuertsHttpClient 才可用.
 */

import * as UE from 'ue';

import { parseHeadersJson } from './Json';
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse, HttpTransportTask } from './types';

interface UnrealPuertsHttpRequestOptions {
    Url: string;
    Verb: string;
    HeadersJson: string;
    Body: string;
    TimeoutSeconds: number;
}

interface UnrealPuertsHttpResponse {
    RequestId: number;
    StatusCode: number;
    bSucceeded: boolean;
    bCanceled: boolean;
    ErrorMessage: string;
    HeadersJson: string;
    Body: string;
}

interface UnrealPuertsHttpClient {
    Send(options: UnrealPuertsHttpRequestOptions, callback: (response: UnrealPuertsHttpResponse) => void): number;
    Cancel(requestId: number): boolean;
    CancelAll(): void;
}

interface UnrealHttpBindings {
    NewObject(cls: UE.Class): unknown;
    PuertsHttpClient?: {
        StaticClass(): UE.Class;
    };
    PuertsHttpRequestOptions?: new () => UnrealPuertsHttpRequestOptions;
}

/** 对接 Plugins/PuertsHttpTransport 的 {@link HttpTransport} 实现. */
export class UnrealHttpTransport implements HttpTransport {
    private client?: UnrealPuertsHttpClient;

    send(request: HttpTransportRequest): HttpTransportTask {
        let requestId = 0;
        // 防止 Send 同步失败与异步回调/ cancel 竞态重复 settle.
        let settled = false;
        let rejectTask: (error: unknown) => void = () => undefined;

        const promise = new Promise<HttpTransportResponse>((resolve, reject) => {
            rejectTask = reject;

            try {
                const client = this.getClient();
                const options = this.createRequestOptions(request);
                requestId = client.Send(options, (response) => {
                    settled = true;
                    resolve({
                        requestId: response.RequestId,
                        statusCode: response.StatusCode,
                        succeeded: response.bSucceeded,
                        canceled: response.bCanceled,
                        errorMessage: response.ErrorMessage,
                        headers: parseHeadersJson(response.HeadersJson),
                        body: response.Body || '',
                    });
                });

                if (requestId <= 0 && !settled) {
                    reject(new Error('PuertsHttpTransport failed to start request.'));
                }
            } catch (error) {
                settled = true;
                reject(error);
            }
        });

        return {
            get requestId() {
                return requestId;
            },
            promise,
            cancel: (reason = 'HTTP request canceled') => {
                if (settled) {
                    return;
                }

                settled = true;
                if (requestId > 0) {
                    this.client?.Cancel(requestId);
                }
                rejectTask(new Error(reason));
            },
        };
    }

    cancelAll(): void {
        this.client?.CancelAll();
    }

    /** 懒创建 UPuertsHttpClient 实例; 同一 Transport 复用以共享 Pending 请求表. */
    private getClient(): UnrealPuertsHttpClient {
        if (this.client) {
            return this.client;
        }

        const bindings = UE as unknown as UnrealHttpBindings;
        const clientClass = bindings.PuertsHttpClient;
        if (!clientClass) {
            throw new Error(
                'PuertsHttpTransport plugin type UE.PuertsHttpClient is unavailable. Rebuild Unreal and regenerate Puerts d.ts.'
            );
        }

        this.client = bindings.NewObject(clientClass.StaticClass()) as UnrealPuertsHttpClient;
        return this.client;
    }

    /** Headers 以 JSON 字符串传入 C++ 层, 与 FPuertsHttpRequestOptions 反射字段一致. */
    private createRequestOptions(request: HttpTransportRequest): UnrealPuertsHttpRequestOptions {
        const bindings = UE as unknown as UnrealHttpBindings;
        const options = bindings.PuertsHttpRequestOptions
            ? new bindings.PuertsHttpRequestOptions()
            : ({} as UnrealPuertsHttpRequestOptions);

        options.Url = request.url;
        options.Verb = request.method;
        options.HeadersJson = JSON.stringify(request.headers);
        options.Body = request.body || '';
        options.TimeoutSeconds = request.timeoutMs > 0 ? request.timeoutMs / 1000 : 0;
        return options;
    }
}
