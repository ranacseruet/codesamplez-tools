import { formatBytes } from '../common/format-utils';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { scheduleTask } from '../common/scheduler-utils';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { registerDropZone } from '../common/drop-zone';
import { hydrate, render } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { JSMinifierArticle, JSMinifierIntro } from './content';
import { loadMinifier, type MinifierConstructor } from './load-minifier';
import toolMetadata from './tool.meta.json';

// The minifier engine is the Babel parser/traverse/generator stack (~803 KB
// raw). It is loaded lazily via the `./load-minifier` seam on first minify so
// it stays out of the initial page bundle — visitors who never minify never pay
// for it. See GitHub issue #396.

const DEFAULT_OPTIONS = {
  removeComments: true,
  removeWhitespace: true,
  shortenVariables: false,
  mangleProperties: false
};

// Sample JavaScript code
const SAMPLE_CODE = `// Example JavaScript function
function calculateSum(numbers) {
  // This function calculates the sum of all numbers in an array
  let sum = 0;

  for (let i = 0; i < numbers.length; i++) {
    // Add each number to the sum
    sum = sum + numbers[i];
  }

  // Return the final sum
  return sum;
}

// Example usage
const myNumbers = [1, 2, 3, 4, 5];
const result = calculateSum(myNumbers);
console.log("The sum is: " + result);`;

function createDefaultOptions() {
  return { ...DEFAULT_OPTIONS };
}

function calculateStats(original = '', minified = '') {
  const originalBytes = new Blob([original]).size;
  const minifiedBytes = new Blob([minified]).size;
  const ratio = originalBytes ? ((1 - minifiedBytes / originalBytes) * 100).toFixed(2) : '0.00';

  return {
    originalSizeLabel: formatBytes(originalBytes),
    minifiedSizeLabel: formatBytes(minifiedBytes),
    ratioLabel: `${ratio}%`
  };
}

export function JSMinifierApp() {
  const [inputCode, setInputCode] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [options, setOptions] = useState(createDefaultOptions);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingEngine, setIsLoadingEngine] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const clearButtonRef = useRef(null);
  const copyButtonRef = useRef(null);
  const engineRef = useRef<MinifierConstructor | null>(null);
  // Tracks the latest input synchronously (updated at every input source) so a
  // minify whose engine load / yield finished after the user kept typing can
  // drop its now-stale result instead of showing output for old input alongside
  // stats computed from the new input.
  const latestInputRef = useRef(inputCode);

  // Lazily fetch + cache the Babel minifier engine chunk. First call shows the
  // "Loading…" button state while the chunk downloads; later calls resolve from
  // the in-memory cache (webpack also caches the chunk itself).
  const loadMinifierEngine = async (): Promise<MinifierConstructor> => {
    if (!engineRef.current) {
      setIsLoadingEngine(true);
      try {
        engineRef.current = await loadMinifier();
      } finally {
        setIsLoadingEngine(false);
      }
    }
    return engineRef.current;
  };

  const stats = useMemo(() => calculateStats(inputCode, outputCode), [inputCode, outputCode]);

  useEffect(() => {
    if (!(inputRef.current instanceof HTMLTextAreaElement)) {
      return undefined;
    }

    const inputEl = inputRef.current;
    clearButtonRef.current = new ClearButton(inputEl);

    const handleTextCleared = () => {
      latestInputRef.current = inputEl.value;
      setInputCode(inputEl.value);
      setOutputCode('');
      setErrorMessage('');
      NotificationManager.show('Input cleared', 2000, { type: 'success' });
    };

    inputEl.addEventListener('textCleared', handleTextCleared);

    return () => {
      inputEl.removeEventListener('textCleared', handleTextCleared);
      clearButtonRef.current?.disconnect?.();
    };
  }, []);

  useEffect(() => {
    clearButtonRef.current?.updateVisibility?.();
  }, [inputCode]);

  useEffect(() => {
    if (!(outputRef.current instanceof HTMLTextAreaElement)) {
      return undefined;
    }

    const outputEl = outputRef.current;
    copyButtonRef.current = new CopyButton(outputEl);

    const handleContentCopied = () => {
      NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
    };

    outputEl.addEventListener('contentCopied', handleContentCopied);

    return () => {
      outputEl.removeEventListener('contentCopied', handleContentCopied);
      copyButtonRef.current?.disconnect?.();
    };
  }, []);

  useEffect(() => {
    copyButtonRef.current?.updateVisibility?.();
  }, [outputCode]);

  useEffect(() => {
    const primaryButton = document.getElementById('js-minifier-minify-btn');
    if (!primaryButton) {
      /* istanbul ignore next */
      return undefined;
    }
    return registerPrimaryActionShortcut(primaryButton);
  }, []);

  const runMinify = async (codeOverride = inputCode, optionsOverride = options) => {
    const code = String(codeOverride ?? '');

    if (!code.trim()) {
      setOutputCode('');
      setErrorMessage('Please enter JavaScript to minify');
      return false;
    }

    setIsProcessing(true);

    try {
      // Lazy-load the Babel engine (kept out of the initial bundle), then yield
      // so the busy/loading button state paints before the synchronous minify.
      const JSMinifier = await loadMinifierEngine();
      await scheduleTask(20);

      // The user may have kept typing while the engine loaded/yielded. Drop this
      // run rather than show minified output for stale input next to stats
      // computed from the current input.
      if (code !== latestInputRef.current) {
        return false;
      }

      const minifier = new JSMinifier(optionsOverride);
      const minified = minifier.minify(code);
      setOutputCode(minified);
      setErrorMessage('');

      const originalBytes = new Blob([code]).size;
      const minifiedBytes = new Blob([minified]).size;
      const ratio = originalBytes ? ((1 - minifiedBytes / originalBytes) * 100).toFixed(2) : '0.00';
      NotificationManager.show(`JavaScript minified successfully! (${ratio}% reduction)`, 2000, { type: 'success' });
      return true;
    } catch (error) {
      setOutputCode('');
      setErrorMessage(error.message);
      console.error('Minification error:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    latestInputRef.current = nextValue;
    setInputCode(nextValue);
    if (nextValue === '') {
      setOutputCode('');
      setErrorMessage('');
    }
  };

  // A dropped file behaves exactly like Load Sample carrying that file's
  // contents — fill the input, then run the tool. Re-registered when `options`
  // change so the minify call never uses a stale option set.
  useLayoutEffect(() => {
    if (!(inputRef.current instanceof HTMLTextAreaElement)) {
      /* istanbul ignore next */
      return undefined;
    }

    return registerDropZone(inputRef.current, {
      onText: (text, file) => {
        latestInputRef.current = text;
        setInputCode(text);
        setErrorMessage('');
        NotificationManager.show(`Loaded ${file.name}`, 2000, { type: 'success' });
        void runMinify(text, options);
      },
      onError: (message) => NotificationManager.show(message, 3000, { type: 'error' })
    });
  }, [options]);

  const updateOption = (key) => async (event) => {
    const checked = Boolean(event.target.checked);
    const nextOptions = { ...options, [key]: checked };
    setOptions(nextOptions);
    await runMinify(inputCode, nextOptions);
  };

  const handleLoadSample = async () => {
    latestInputRef.current = SAMPLE_CODE;
    setInputCode(SAMPLE_CODE);
    const success = await runMinify(SAMPLE_CODE, options);
    if (success) {
      NotificationManager.show('Sample code loaded and minified', 1500, { type: 'success' });
    }
  };

  return (
    <div id="js-minifier-tool" className="js-minifier-container tool-container c-tool-stack">
      <div className="js-minifier-options c-options-panel c-surface-card">
        <h3>Minification Options</h3>
        <div className="c-checkbox-group">
          <div className="c-checkbox-item">
            <input
              type="checkbox"
              id="js-minifier-remove-comments"
              checked={options.removeComments}
              onChange={updateOption('removeComments')}
            />
            <label htmlFor="js-minifier-remove-comments">Remove comments</label>
          </div>
          <div className="c-checkbox-item">
            <input
              type="checkbox"
              id="js-minifier-remove-whitespace"
              checked={options.removeWhitespace}
              onChange={updateOption('removeWhitespace')}
            />
            <label htmlFor="js-minifier-remove-whitespace">Remove whitespace</label>
          </div>
          <div className="c-checkbox-item">
            <input
              type="checkbox"
              id="js-minifier-shorten-variables"
              checked={options.shortenVariables}
              onChange={updateOption('shortenVariables')}
            />
            <label htmlFor="js-minifier-shorten-variables">Shorten variable names</label>
            <button
              type="button"
              className="c-tooltip-container"
              aria-label="More information about shortening variable names"
              aria-describedby="tooltip-shorten-vars"
            >
              ⓘ
              <span id="tooltip-shorten-vars" className="c-tooltip" role="tooltip">
                This is experimental and may break your code
              </span>
            </button>
          </div>
          <div className="c-checkbox-item">
            <input
              type="checkbox"
              id="js-minifier-mangle-properties"
              checked={options.mangleProperties}
              onChange={updateOption('mangleProperties')}
            />
            <label htmlFor="js-minifier-mangle-properties">Mangle properties</label>
            <button
              type="button"
              className="c-tooltip-container"
              aria-label="More information about mangling properties"
              aria-describedby="tooltip-mangle-props"
            >
              ⓘ
              <span id="tooltip-mangle-props" className="c-tooltip" role="tooltip">
                This is experimental and may break your code
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="o-grid-2col">
        <div className="o-panel c-surface-card c-surface-panel">
          <h3>Original JavaScript</h3>
          <textarea
            id="js-minifier-input"
            ref={inputRef}
            className="c-input c-input--textarea"
            placeholder="Paste your JavaScript code here, or drop a file..."
            aria-label="Input JavaScript"
            value={inputCode}
            onInput={handleInputChange}
          />
          <div
            id="js-minifier-error-status"
            className={`c-input-status js-minifier-input-status${errorMessage ? ' error' : ''}`}
            role={errorMessage ? 'alert' : 'status'}
            aria-live="polite"
          >
            {errorMessage}
          </div>
        </div>

        <div className="o-panel c-surface-card c-surface-panel">
          <h3>Minified JavaScript</h3>
          <textarea
            id="js-minifier-output"
            ref={outputRef}
            className={`c-input c-input--textarea${isProcessing ? ' processing' : ''}`}
            readOnly
            placeholder="Minified code will appear here..."
            aria-label="Minified Output"
            value={outputCode}
          />
        </div>
      </div>

      <div className="js-minifier-toolbar o-toolbar c-action-strip">
        <button id="js-minifier-load-sample-btn" className="c-button c-button--ghost" onClick={() => void handleLoadSample()}>
          Load Sample
        </button>
        <span className="c-toolbar__spacer" />
        <button id="js-minifier-minify-btn" className="c-button" onClick={() => void runMinify()} disabled={isProcessing || isLoadingEngine}>
          {isLoadingEngine ? 'Loading…' : isProcessing ? 'Minifying...' : 'Minify JavaScript'}
          {!(isProcessing || isLoadingEngine) && <span className="c-kbd" aria-hidden="true">⌘⏎</span>}
        </button>
      </div>

      <div className="js-minifier-stats c-stats-panel c-surface-card">
        <h3>Statistics</h3>
        <div className="c-stat-row js-minifier-stat-row">
          <span>Original Size:</span>
          <span id="js-minifier-original-size">{stats.originalSizeLabel}</span>
        </div>
        <div className="c-stat-row js-minifier-stat-row">
          <span>Minified Size:</span>
          <span id="js-minifier-minified-size">{stats.minifiedSizeLabel}</span>
        </div>
        <div className="c-stat-row js-minifier-stat-row">
          <span>Compression Ratio:</span>
          <span id="js-minifier-compression-ratio">{stats.ratioLabel}</span>
        </div>
      </div>

      <div id="notification" className="c-notification" role="status" aria-live="polite" />

      {/* Tool-first ordering: About intro + guide below the interactive tool. */}
      <JSMinifierIntro />
      <JSMinifierArticle />
    </div>
  );
}

export class JSMinifierToolUI {
  constructor(rootSelector = '#js-minifier-app') {
    const root = document.querySelector(rootSelector) || document.querySelector('#js-minifier-tool');
    if (!root) {
      throw new Error('JavaScript Minifier root element not found');
    }

    const mount = root.hasChildNodes() ? hydrate : render;
    mount(<JSMinifierApp />, root);
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    mountToolShell({
      title: toolMetadata.title,
      description: toolMetadata.description,
      homeHref: '/'
    });

    new JSMinifierToolUI();
  });
}
