import { jest } from '@jest/globals';
import { exposeWorker } from './worker-harness';

// In jsdom `self` is the window; exposeWorker assigns `self.onmessage` and calls
// `self.postMessage`. We capture posts and invoke the registered handler with a
// synthetic MessageEvent shape.
describe('exposeWorker', () => {
    let posted;

    beforeEach(() => {
        posted = [];
        jest.spyOn(self, 'postMessage').mockImplementation((message) => posted.push(message));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        self.onmessage = null;
    });

    it('posts a result correlated to the request id', async () => {
        exposeWorker((payload) => payload * 2);

        await self.onmessage({ data: { id: 7, payload: 21 } });

        expect(posted).toEqual([{ id: 7, result: 42 }]);
    });

    it('awaits async compute functions', async () => {
        exposeWorker(async (payload) => payload + 1);

        await self.onmessage({ data: { id: 1, payload: 41 } });

        expect(posted).toEqual([{ id: 1, result: 42 }]);
    });

    it('posts the message from a thrown Error', async () => {
        exposeWorker(() => {
            throw new Error('boom');
        });

        await self.onmessage({ data: { id: 2, payload: null } });

        expect(posted).toEqual([{ id: 2, error: 'boom' }]);
    });

    it('posts a generic error for a non-Error throw', async () => {
        exposeWorker(() => {
            throw 'nope';
        });

        await self.onmessage({ data: { id: 3, payload: null } });

        expect(posted).toEqual([{ id: 3, error: 'worker computation failed' }]);
    });

    it('routes async rejections to an error response', async () => {
        exposeWorker(async () => {
            throw new Error('async boom');
        });

        await self.onmessage({ data: { id: 4, payload: null } });

        expect(posted).toEqual([{ id: 4, error: 'async boom' }]);
    });
});
