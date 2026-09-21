import { JSONFormatter } from './script';
import * as NotificationManagerModule from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/format-utils', () => ({
  formatBytes: jest.fn(bytes => `${bytes} formatted`)
}));

jest.mock('../common/DownloadManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      downloadFile: jest.fn()
    };
  });
});

jest.mock('../common/clear-button/ClearButton', () => {
  return jest.fn().mockImplementation(() => {
    return {
      updateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
  });
});

// Resolve the yield immediately so sequencing below is plain microtasks.
jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn(() => Promise.resolve()),
  nextFrame: jest.fn(() => Promise.resolve())
}));

/**
 * Regression tests for issue #9: a worker run superseded by a newer one must
 * never paint its result, error, or control state over the newer run.
 *
 * Inputs exceed the 50k worker threshold so formatJSON dispatches through
 * `lazyFormatRunner`, which is stubbed per scenario to reproduce exactly the
 * two contracts `createLazyRunner` exposes to callers:
 *   1. a run superseded while the runner chunk loads resolves `undefined`
 *      (the `shouldAbort` branch), and
 *   2. a superseded run whose fallback throws (e.g. invalid JSON) rejects.
 */
describe('formatJSON superseded-run guards', () => {
  let formatter;
  let mockNotificationManager;

  /** A valid-JSON-shaped input above the 50k sync threshold. */
  const overThresholdInput = (marker) =>
    JSON.stringify({ marker, pad: 'x'.repeat(51_000) });

  /** Drain pending microtasks (scheduler yields resolve immediately). */
  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

  const createFormatter = () => {
    const formatter = new JSONFormatter(false);
    formatter.input = { value: '' };
    formatter.output = document.createElement('div');
    formatter.plainViewTextarea = { value: '' };
    formatter.viewContainers = {
      tree: { classList: { add: jest.fn(), remove: jest.fn() } },
      plain: { classList: { add: jest.fn(), remove: jest.fn() } }
    };
    formatter.tabs = [];
    formatter.copyBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.downloadBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.expandAllBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.collapseAllBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.indentSelect = { value: '2', addEventListener: jest.fn() };
    formatter.errorStatus = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    formatter.goToErrorBtn = { hidden: true, textContent: '', addEventListener: jest.fn() };
    formatter.originalSizeEl = { textContent: '' };
    formatter.formattedSizeEl = { textContent: '' };
    formatter.sortCheckbox = { checked: false };
    formatter.autoFixCheckbox = { checked: false };
    formatter.formatBtn = { textContent: 'Format JSON', disabled: false, addEventListener: jest.fn() };
    formatter.sampleBtn = { addEventListener: jest.fn() };
    formatter.shareBtn = { addEventListener: jest.fn() };
    formatter.clearButtonInstance = { updateVisibility: jest.fn(), disconnect: jest.fn() };
    formatter.downloadManager = new DownloadManager();
    formatter.emptyStateEl = { style: { display: '' } };
    formatter.schemaStatus = null;
    formatter.currentRunId = 0;
    formatter.schemaValidationRunId = 0;
    return formatter;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationManager = NotificationManagerModule.NotificationManager;
  });

  test('drops an undefined result from a run superseded during chunk load', async () => {
    const formatter = createFormatter();
    let releaseRun1;
    let run1SupersededAtRelease = null;
    formatter.lazyFormatRunner = {
      run: jest.fn((payload, shouldAbort) => {
        if (payload.input.includes('"marker":"run1"')) {
          // Park until run 2 has started, then answer the staleness probe —
          // resolving the sentinel the caller must drop when superseded,
          // exactly like createLazyRunner's shouldAbort branch.
          return new Promise((resolve) => {
            releaseRun1 = () => {
              run1SupersededAtRelease = shouldAbort ? shouldAbort() : null;
              if (run1SupersededAtRelease) {
                resolve(undefined);
              } else {
                resolve({ formatted: payload.input, formattedString: payload.input });
              }
            };
          });
        }
        expect(typeof shouldAbort).toBe('function');
        return Promise.resolve({ formatted: payload.input, formattedString: payload.input });
      }),
      terminate: jest.fn()
    };

    formatter.input.value = overThresholdInput('run1');
    const firstPromise = formatter.formatJSON();

    // Let run 1 pass its scheduleTask yield and park inside the runner await.
    await flushMicrotasks();

    // Start run 2: it captures a newer runId, runs, and completes.
    formatter.input.value = overThresholdInput('run2');
    const secondPromise = formatter.formatJSON();
    await flushMicrotasks();

    releaseRun1();
    await Promise.all([firstPromise, secondPromise]);

    // The sentinel path was actually exercised.
    expect(run1SupersededAtRelease).toBe(true);
    // The newer run's output wins; the stale run painted nothing.
    expect(formatter.plainViewTextarea.value).toContain('"marker":"run2"');
    expect(formatter.plainViewTextarea.value).not.toContain('"marker":"run1"');
    expect(formatter.errorStatus.textContent).toBe('');
    expect(formatter.copyBtn.disabled).toBe(false);
    expect(formatter.downloadBtn.disabled).toBe(false);
    expect(mockNotificationManager.show).toHaveBeenCalledWith(
      'JSON formatted successfully!',
      2000,
      { type: 'success' }
    );
  });

  test('does not report a stale run\'s error over a newer run (catch-path runId guard)', async () => {
    const formatter = createFormatter();
    let rejectRun1;
    formatter.lazyFormatRunner = {
      run: jest.fn((payload) => {
        if (payload.input.includes('"marker":"run1"')) {
          // A slow fallback throwing after a newer run started: the real-world
          // path is a large invalid input whose main-thread fallback rejects
          // while the user has already started a newer run.
          return new Promise((resolve, reject) => {
            rejectRun1 = () => reject(new Error('Unexpected token x in JSON at position 2'));
          });
        }
        return Promise.resolve({ formatted: payload.input, formattedString: payload.input });
      }),
      terminate: jest.fn()
    };

    formatter.input.value = overThresholdInput('run1');
    const firstPromise = formatter.formatJSON();

    // Let run 1 pass its scheduleTask yield and park inside the runner await.
    await flushMicrotasks();

    formatter.input.value = overThresholdInput('run2');
    const secondPromise = formatter.formatJSON();
    await flushMicrotasks();

    rejectRun1();
    await Promise.all([firstPromise, secondPromise]);

    // The stale run's failure must not paint: no error text, newer output
    // intact, controls enabled by the newer run's success.
    expect(formatter.errorStatus.textContent).toBe('');
    expect(formatter.plainViewTextarea.value).toContain('"marker":"run2"');
    expect(formatter.plainViewTextarea.value).not.toContain('"marker":"run1"');
    expect(formatter.copyBtn.disabled).toBe(false);
    expect(formatter.expandAllBtn.disabled).toBe(false);
  });

  test('still reports errors for the current run when the fallback throws', async () => {
    // Sanity check that the new guard only suppresses STALE failures.
    const formatter = createFormatter();
    formatter.lazyFormatRunner = {
      run: jest.fn(() => Promise.reject(new Error('boom'))),
      terminate: jest.fn()
    };

    formatter.input.value = overThresholdInput('solo');
    await formatter.formatJSON();

    expect(formatter.errorStatus.textContent).toContain('boom');
    expect(formatter.copyBtn.disabled).toBe(true);
    expect(formatter.expandAllBtn.disabled).toBe(true);
    expect(formatter.formatBtn.disabled).toBe(false);
  });

  test('passes a staleness probe to the runner for over-threshold input', async () => {
    const formatter = createFormatter();
    const run = jest.fn((payload, shouldAbort) => {
      expect(typeof shouldAbort).toBe('function');
      expect(shouldAbort()).toBe(false);
      return Promise.resolve({ formatted: payload.input, formattedString: payload.input });
    });
    formatter.lazyFormatRunner = { run, terminate: jest.fn() };

    formatter.input.value = overThresholdInput('wired');
    await formatter.formatJSON();

    expect(run).toHaveBeenCalledTimes(1);
    expect(formatter.plainViewTextarea.value).toContain('"marker":"wired"');
  });
});
