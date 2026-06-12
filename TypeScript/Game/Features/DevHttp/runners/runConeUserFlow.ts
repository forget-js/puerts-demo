/**
 * BP_ConeActor Map_Test Apifox / 真实 HTTP 联调序列.
 */

import { GF, GE } from '../../../../Global';
import { Api } from '../../../Services/Api';
import { HttpError } from '../../../../Runtime';

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
        await Api.testUser.createUser(demoUser, options);
        GF.LogPrettyJson(owner as never, 'testUser.createUser', { username: demoUser.username });

        const user = await Api.testUser.getUserByName(demoUser.username, options);
        GF.LogPrettyJson(owner as never, 'testUser.getUserByName', user);

        await Api.testUser.updateUser(demoUser.username, { ...user, firstName: 'ConeUpdated' }, options);
        GF.LogPrettyJson(owner as never, 'testUser.updateUser', { username: demoUser.username });

        await Api.testUser.deleteUser(demoUser.username, options);
        GF.LogPrettyJson(owner as never, 'testUser.deleteUser', { username: demoUser.username });
    } catch (error) {
        const message =
            error instanceof HttpError
                ? `${error.kind}: ${error.message}${error.url ? ` (${error.method ?? '?'} ${error.url})` : ''}`
                : String(error);
        GF.LogPrettyJson(owner as never, 'testUser HTTP demo failed', { message }, { level: GE.LogLevel.Warning });
    }
}
