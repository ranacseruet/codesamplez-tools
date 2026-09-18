import { createSchemaValidationRunner } from './schema-validation-runner';

describe('schema validation runner', () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    if (originalWorker) globalThis.Worker = originalWorker;
    else delete globalThis.Worker;
  });

  test('returns unavailable when workers are unavailable instead of validating on main', async () => {
    delete globalThis.Worker;
    const runner = createSchemaValidationRunner();

    await expect(runner.run({ data: '{}', schema: '{"type":"object"}' })).resolves.toMatchObject({
      outcome: 'unavailable'
    });
    expect(runner.isFallbackOnly).toBe(true);
  });

  test('constructs the dedicated worker when workers are available', async () => {
    class RespondingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;

      postMessage(message: { id: number }): void {
        queueMicrotask(() => this.onmessage?.({
          data: { id: message.id, result: { outcome: 'valid', draft: 'draft-07' } }
        } as MessageEvent));
      }

      terminate(): void {}
    }

    globalThis.Worker = RespondingWorker as unknown as typeof Worker;
    const runner = createSchemaValidationRunner();

    await expect(runner.run({ data: '{}', schema: '{"type":"object"}' })).resolves.toMatchObject({
      outcome: 'valid',
      draft: 'draft-07'
    });
  });
});
