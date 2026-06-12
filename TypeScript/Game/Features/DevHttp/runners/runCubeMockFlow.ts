/**
 * BP_Cube Map_Test Mock HTTP 联调序列.
 */

import { GF } from '../../../../Global';
import { Api } from '../../../Services/Api';
import { HttpError } from '../../../../Runtime';

export async function runCubeMockFlow(owner: object): Promise<void> {
    const options = { owner };

    try {
        const ping = await Api.test.ping(options);
        GF.Log(owner as never, 'test.ping', { context: { ...ping }, toScreen: false });
        const echo = await Api.test.echoQuery('Cube', options);
        GF.Log(owner as never, 'test.echoQuery', { context: { ...echo }, toScreen: false });
        const created = await Api.test.createItem({ name: 'MockSword', quantity: 1 }, options);
        GF.Log(owner as never, 'test.createItem', { context: { ...created }, toScreen: false });
        const updated = await Api.test.updateItem(created.id, { name: 'MockSword+', quantity: 2 }, options);
        GF.Log(owner as never, 'test.updateItem', { context: { ...updated }, toScreen: false });
        const deleted = await Api.test.deleteItem(created.id, options);
        GF.Log(owner as never, 'test.deleteItem', { context: { ...deleted }, toScreen: false });
    } catch (error) {
        const message = error instanceof HttpError ? `${error.kind}: ${error.message}` : String(error);
        GF.Warn(owner as never, 'test HTTP demo failed', { context: { message }, toScreen: false });
    }
}
