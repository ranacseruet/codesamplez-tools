import { JSMinifier } from './minifier.js';
import { formatBytes } from '../common/format-utils.js';
import { NotificationManager } from '../common/notification-manager.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import CopyButton from '../common/copy-button/CopyButton.js';
import { scheduleTask } from '../common/scheduler-utils.js';
import { hydrate, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell.js';

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

if (typeof window !== 'undefined') {
  window.JSMinifier = JSMinifier;
}

export function JSMinifierApp() {
  const [inputCode, setInputCode] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [options, setOptions] = useState(createDefaultOptions);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const clearButtonRef = useRef(null);
  const copyButtonRef = useRef(null);

  const stats = useMemo(() => calculateStats(inputCode, outputCode), [inputCode, outputCode]);

  useEffect(() => {
    if (!(inputRef.current instanceof HTMLTextAreaElement)) {
      return undefined;
    }

    const inputEl = inputRef.current;
    clearButtonRef.current = new ClearButton(inputEl);

    const handleTextCleared = () => {
      setInputCode(inputEl.value);
      setOutputCode('');
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

  const runMinify = async (codeOverride = inputCode, optionsOverride = options) => {
    const code = String(codeOverride ?? '');

    if (!code.trim()) {
      setOutputCode('');
      NotificationManager.show('Please enter JavaScript to minify', 2000, { type: 'error' });
      return false;
    }

    setIsProcessing(true);

    try {
      await scheduleTask(20);

      const minifier = new JSMinifier(optionsOverride);
      const minified = minifier.minify(code);
      setOutputCode(minified);

      const originalBytes = new Blob([code]).size;
      const minifiedBytes = new Blob([minified]).size;
      const ratio = originalBytes ? ((1 - minifiedBytes / originalBytes) * 100).toFixed(2) : '0.00';
      NotificationManager.show(`JavaScript minified successfully! (${ratio}% reduction)`, 2000, { type: 'success' });
      return true;
    } catch (error) {
      setOutputCode('');
      NotificationManager.show(`Minification error: ${error.message}`, 3000, { type: 'error' });
      console.error('Minification error:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    setInputCode(nextValue);
    if (nextValue === '') {
      setOutputCode('');
    }
  };

  const updateOption = (key) => async (event) => {
    const checked = Boolean(event.target.checked);
    const nextOptions = { ...options, [key]: checked };
    setOptions(nextOptions);
    await runMinify(inputCode, nextOptions);
  };

  const handleLoadSample = async () => {
    setInputCode(SAMPLE_CODE);
    const success = await runMinify(SAMPLE_CODE, options);
    if (success) {
      NotificationManager.show('Sample code loaded and minified', 1500, { type: 'success' });
    }
  };

  return (
    <div id="js-minifier-tool" className="js-minifier-container tool-container c-tool-stack">
      <header className="js-minifier-header c-tool-header c-surface-card">
        <p className="o-description c-tool-description">Minify your JavaScript code to reduce file size and improve load times</p>
      </header>

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
            placeholder="Paste your JavaScript code here..."
            aria-label="Input JavaScript"
            value={inputCode}
            onInput={handleInputChange}
          />
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
        <button id="js-minifier-minify-btn" className="c-button" onClick={() => void runMinify()} disabled={isProcessing}>
          {isProcessing ? 'Minifying...' : 'Minify JavaScript'}
        </button>
        <button id="js-minifier-load-sample-btn" className="c-button c-button--secondary" onClick={() => void handleLoadSample()}>
          Load Sample
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

      <footer className="js-minifier-footer">
        <p>JavaScript Minifier - Use at your own risk. Always test minified code before deployment.</p>
      </footer>

      <div id="notification" className="c-notification" role="status" aria-live="polite">
        Copied to clipboard!
      </div>
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
      title: 'JavaScript Minifier',
      description: 'Minify JavaScript to reduce payload size while preserving functionality.',
      homeHref: '/'
    });

    new JSMinifierToolUI();
  });
}
