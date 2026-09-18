import { jest } from '@jest/globals';
import { createLazyRunner } from './lazy-runner';

describe('createLazyRunner', () => {
    it('imports the factory, runs in the worker, and reuses the runner across calls', async () => {
        const run = jest.fn(async (payload) => `worker:${payload}`);
        const terminate = jest.fn();
        const create = jest.fn(() => ({ run, terminate }));
        const importFactory = jest.fn(async () => create);

        const runner = createLazyRunner(importFactory, () => 'fallback');

        expect(await runner.run('a')).toBe('worker:a');
        expect(await runner.run('b')).toBe('worker:b');

        // Factory imported each run, but the runner is constructed only once.
        expect(importFactory).toHaveBeenCalledTimes(2);
        expect(create).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('falls back to the main thread when the runner chunk fails to load', async () => {
        const fallback = jest.fn((payload) => `fallback:${payload}`);
        const importFactory = jest.fn(() => Promise.reject(new Error('chunk load failed')));

        const runner = createLazyRunner(importFactory, fallback);

        expect(await runner.run('x')).toBe('fallback:x');
        expect(fallback).toHaveBeenCalledWith('x');
    });

    it('falls back when the worker run rejects', async () => {
        const run = jest.fn(() => Promise.reject(new Error('worker blew up')));
        const create = () => ({ run, terminate: jest.fn() });
        const fallback = jest.fn(() => 'recovered');

        const runner = createLazyRunner(async () => create, fallback);

        expect(await runner.run('y')).toBe('recovered');
        expect(fallback).toHaveBeenCalledWith('y');
    });

    it('abandons a run superseded during chunk load without dispatching', async () => {
        const run = jest.fn(async () => 'worker');
        const create = jest.fn(() => ({ run, terminate: jest.fn() }));
        const fallback = jest.fn(() => 'fallback');

        const runner = createLazyRunner(async () => create, fallback);

        // shouldAbort returns true (request superseded while the chunk loaded):
        // neither the worker nor the fallback should run.
        await runner.run('stale', () => true);

        expect(run).not.toHaveBeenCalled();
        expect(fallback).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('dispatches normally when shouldAbort returns false', async () => {
        const run = jest.fn(async (payload) => `worker:${payload}`);
        const runner = createLazyRunner(async () => () => ({ run, terminate: jest.fn() }), () => 'fallback');

        expect(await runner.run('fresh', () => false)).toBe('worker:fresh');
        expect(run).toHaveBeenCalledWith('fresh');
    });

    it('terminates the constructed runner and is safe before any run', () => {
        const terminate = jest.fn();
        const create = () => ({ run: jest.fn(), terminate });

        const runner = createLazyRunner(async () => create, () => null);

        // No runner constructed yet — terminate must not throw.
        expect(() => runner.terminate()).not.toThrow();
        expect(terminate).not.toHaveBeenCalled();
    });

    it('terminates a runner once it has been constructed', async () => {
        const terminate = jest.fn();
        const run = jest.fn(async () => 'ok');
        const runner = createLazyRunner(async () => () => ({ run, terminate }), () => null);

        await runner.run('z');
        runner.terminate();

        expect(terminate).toHaveBeenCalledTimes(1);
    });
});
