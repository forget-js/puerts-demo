/**
 * BP_ConeActor Map_Test Apifox / 真实 HTTP 联调序列.
 */

import { GF, GE } from '../../../../Global';
import { Api } from '../../../Services/Api';
import { HttpError, type HttpTask } from '../../../../Runtime';

const RESPONSE_BODY_PREVIEW_LENGTH = 512;

export async function runConeUserFlow(owner: object): Promise<void> {
    const options = { owner };
    const demoUser = {
        username: 'ConeDemoUser',
        firstName: 'Cone',
        lastName: 'Actor',
        email: 'cone.demo@example.com',
        password: 'demo-password',
        phone: '13800000000',
        userStatus: 0,
    };

    try {
        await runLoggedHttpStep(owner, 'testUser.createUser', () => Api.testUser.createUser(demoUser, options));

        const user = await runLoggedHttpStep(owner, 'testUser.getUserByName', () =>
            Api.testUser.getUserByName(demoUser.username, options)
        );

        await runLoggedHttpStep(owner, 'testUser.updateUser', () =>
            Api.testUser.updateUser(demoUser.username, { ...user, firstName: 'ConeUpdated' }, options)
        );

        await runLoggedHttpStep(owner, 'testUser.deleteUser', () =>
            Api.testUser.deleteUser(demoUser.username, options)
        );
    } catch (error) {
        const message =
            error instanceof HttpError
                ? `${error.kind}: ${error.message}${error.url ? ` (${error.method ?? '?'} ${error.url})` : ''}`
                : String(error);
        GF.LogPrettyJson(owner as never, 'testUser HTTP demo failed', { message }, { level: GE.LogLevel.Warning });
    }
}

async function runLoggedHttpStep<T>(owner: object, label: string, createTask: () => HttpTask<T>): Promise<T> {
    const startedAt = Date.now();
    let task: HttpTask<T> | undefined;

    try {
        task = createTask();
        const result = await task;
        GF.LogPrettyJson(owner as never, label, {
            requestId: task.requestId,
            elapsedMs: Date.now() - startedAt,
            result,
        });
        return result;
    } catch (error) {
        // 真实外网联调优先保留定位信息, 方便判断问题来自网络、UE Transport 还是服务端.
        GF.LogPrettyJson(owner as never, `${label} failed`, makeHttpFailureDetails(error, task, startedAt), {
            level: GE.LogLevel.Warning,
        });
        throw error;
    }
}

function makeHttpFailureDetails(
    error: unknown,
    task: HttpTask<unknown> | undefined,
    startedAt: number
): Record<string, unknown> {
    if (!(error instanceof HttpError)) {
        return {
            requestId: task?.requestId,
            elapsedMs: Date.now() - startedAt,
            message: String(error),
        };
    }

    return {
        kind: error.kind,
        message: error.message,
        method: error.method,
        url: error.url,
        requestId: error.requestId ?? task?.requestId,
        statusCode: error.statusCode,
        attempt: error.attempt,
        elapsedMs: error.elapsedMs ?? Date.now() - startedAt,
        responseBody: previewText(error.responseBody),
    };
}

function previewText(value: string | undefined): string | undefined {
    if (!value || value.length <= RESPONSE_BODY_PREVIEW_LENGTH) {
        return value;
    }

    return `${value.slice(0, RESPONSE_BODY_PREVIEW_LENGTH)}...`;
}
