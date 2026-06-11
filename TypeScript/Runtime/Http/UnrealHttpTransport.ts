/**
 * PuertsHttpTransport 插件的 TypeScript 适配层.
 *
 * 将 {@link HttpTransportRequest} 映射为 UE.PuertsHttpClient.Send 调用,
 * 回调中把 UE.PuertsHttpResponse 转回统一的 {@link HttpTransportResponse}.
 */

import { releaseManualReleaseDelegate, toManualReleaseDelegate } from 'puerts';
import * as UE from 'ue';

import { parseHeadersJson } from './Json';
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse, HttpTransportTask } from './types';

/** 对接 Plugins/PuertsHttpTransport 的 {@link HttpTransport} 实现. */
export class UnrealHttpTransport implements HttpTransport {
    private client?: UE.PuertsHttpClient;

    send(request: HttpTransportRequest): HttpTransportTask {
        let requestId = 0;
        // 防止 Send 同步失败与异步回调/ cancel 竞态重复 settle.
        let settled = false;
        let rejectTask: (error: unknown) => void = () => undefined;
        let responseHandler: ((response: UE.PuertsHttpResponse) => void) | undefined;

        const releaseResponseHandler = (): void => {
            if (!responseHandler) {
                return;
            }

            releaseManualReleaseDelegate(responseHandler);
            responseHandler = undefined;
        };

        const promise = new Promise<HttpTransportResponse>((resolve, reject) => {
            rejectTask = reject;

            try {
                const client = this.getClient();
                const options = this.createRequestOptions(request);

                const onResponse = (response: UE.PuertsHttpResponse): void => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    releaseResponseHandler();
                    resolve({
                        requestId: response.RequestId,
                        statusCode: response.StatusCode,
                        succeeded: response.bSucceeded,
                        canceled: response.bCanceled,
                        errorMessage: response.ErrorMessage,
                        headers: parseHeadersJson(response.HeadersJson),
                        body: response.Body || '',
                    });
                };

                responseHandler = onResponse;
                requestId = client.Send(options, toManualReleaseDelegate(onResponse));

                if (requestId <= 0 && !settled) {
                    settled = true;
                    releaseResponseHandler();
                    reject(new Error('PuertsHttpTransport failed to start request.'));
                }
            } catch (error) {
                settled = true;
                releaseResponseHandler();
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
                releaseResponseHandler();
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
    private getClient(): UE.PuertsHttpClient {
        if (this.client) {
            return this.client;
        }

        this.client = new UE.PuertsHttpClient();
        return this.client;
    }

    /** Headers 以 JSON 字符串传入 C++ 层, 与 UE.PuertsHttpRequestOptions 反射字段一致. */
    private createRequestOptions(request: HttpTransportRequest): UE.PuertsHttpRequestOptions {
        const options = new UE.PuertsHttpRequestOptions();

        options.Url = request.url;
        options.Verb = request.method;
        options.HeadersJson = JSON.stringify(request.headers);
        options.Body = request.body || '';
        options.TimeoutSeconds = request.timeoutMs > 0 ? request.timeoutMs / 1000 : 0;
        return options;
    }
}
