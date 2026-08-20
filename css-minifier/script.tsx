import {
  removeCommentsFromCss,
  removeWhitespaceFromCss,
  shortenColorsInCss,
  removeUnnecessaryUnits,
  removeLastSemicolonsFromCss,
  combineSelectorsInCss,
  isValidCSS
} from './minifier';
import { NotificationManager } from '../common/notification-manager';
import { formatBytes } from '../common/format-utils';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { scheduleTask } from '../common/scheduler-utils';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { hydrate, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { CssMinifierArticle, CssMinifierIntro } from './content';
import toolMetadata from './tool.meta.json';

const DEFAULT_OPTIONS = {
  removeComments: true,
  removeWhitespace: true,
  combineSelectors: true,
  shortenColors: true,
  removeUnits: true,
  removeLastSemicolons: true
};

const SAMPLE_CSS = `/* Basic styles for a simple page */
body {
  color: #333333;
  background-color: #ffffff;
  margin: 0px;
}

/* Duplicate rule to demonstrate combining */
.button {
  background-color: #4a90e2;
  color: #ffffff;
  padding: 10px 20px;
}
.button {
  font-weight: bold;
  text-transform: uppercase;
}

/* Colors to demonstrate shortening */
.color-examples {
  background-color: #000000;
  border-color: #ff0000;
  box-shadow: 0px 0px 5px #aabbcc;
}

/* Zero values to demonstrate unit removal */
.spacing {
  margin: 0px;
  padding: 0px;
  border-width: 0px;
  top: 0px;
}`;

type CssMinifierWindow = Window & {
  removeCommentsFromCss?: typeof removeCommentsFromCss;
  removeWhitespaceFromCss?: typeof removeWhitespaceFromCss;
  shortenColorsInCss?: typeof shortenColorsInCss;
  removeUnnecessaryUnits?: typeof removeUnnecessaryUnits;
  removeLastSemicolonsFromCss?: typeof removeLastSemicolonsFromCss;
  combineSelectorsInCss?: typeof combineSelectorsInCss;
  isValidCSS?: typeof isValidCSS;
};

const browserWindow = typeof window !== 'undefined' ? (window as CssMinifierWindow) : null;

function createDefaultOptions() {
  return { ...DEFAULT_OPTIONS };
}

function applyCssMinificationPipeline(css, options) {
  let result = css;

  if (options.removeComments) {
    result = removeCommentsFromCss(result);
  }
  if (options.combineSelectors) {
    result = combineSelectorsInCss(result);
  }
  if (options.shortenColors) {
    result = shortenColorsInCss(result);
  }
  if (options.removeUnits) {
    result = removeUnnecessaryUnits(result);
  }
  if (options.removeWhitespace) {
    result = removeWhitespaceFromCss(result);
  }
  if (options.removeLastSemicolons) {
    result = removeLastSemicolonsFromCss(result);
  }

  return result;
}

function calculateStats(original = '', minified = '') {
  const originalSize = new Blob([original]).size;
  const minifiedSize = new Blob([minified]).size;
  const savings = originalSize ? (1 - minifiedSize / originalSize) * 100 : 0;

  return {
    originalSizeLabel: formatBytes(originalSize),
    minifiedSizeLabel: formatBytes(minifiedSize),
    savingsLabel: `${savings.toFixed(1)}%`
  };
}

if (browserWindow) {
  browserWindow.removeCommentsFromCss = removeCommentsFromCss;
  browserWindow.removeWhitespaceFromCss = removeWhitespaceFromCss;
  browserWindow.shortenColorsInCss = shortenColorsInCss;
  browserWindow.removeUnnecessaryUnits = removeUnnecessaryUnits;
  browserWindow.removeLastSemicolonsFromCss = removeLastSemicolonsFromCss;
  browserWindow.combineSelectorsInCss = combineSelectorsInCss;
  browserWindow.isValidCSS = isValidCSS;
}

export function CssMinifierApp() {
  const [inputCss, setInputCss] = useState('');
  const [outputCss, setOutputCss] = useState('');
  const [options, setOptions] = useState(createDefaultOptions);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const clearButtonRef = useRef(null);
  const copyButtonRef = useRef(null);

  const stats = useMemo(() => calculateStats(inputCss, outputCss), [inputCss, outputCss]);

  useEffect(() => {
    if (!(inputRef.current instanceof HTMLTextAreaElement)) {
      return undefined;
    }

    const inputEl = inputRef.current;
    clearButtonRef.current = new ClearButton(inputEl);

    const handleTextCleared = () => {
      setInputCss(inputEl.value);
      setOutputCss('');
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
  }, [inputCss]);

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
  }, [outputCss]);

  useEffect(() => {
    const primaryButton = document.getElementById('minify-btn');
    if (!primaryButton) {
      /* istanbul ignore next */
      return undefined;
    }
    return registerPrimaryActionShortcut(primaryButton);
  }, []);

  const resetOptions = () => {
    setOptions(createDefaultOptions());
  };

  const runMinify = async (cssSource = inputCss) => {
    const originalCss = cssSource.trim();

    if (!originalCss) {
      setOutputCss('');
      setErrorMessage('Please enter CSS to minify');
      return false;
    }

    setIsProcessing(true);

    try {
      await scheduleTask(20);

      const valid = await isValidCSS(originalCss);
      if (!valid) {
        setOutputCss('');
        const invalidMessage = 'Invalid CSS input. Please check your CSS syntax.';
        setErrorMessage(invalidMessage);
        return false;
      }

      const result = applyCssMinificationPipeline(originalCss, options);
      setOutputCss(result);
      setErrorMessage('');

      const savings = ((originalCss.length - result.length) / originalCss.length * 100).toFixed(1);
      NotificationManager.show(`CSS minified successfully! Reduced by ${savings}%`, 2000, { type: 'success' });
      return true;
    } catch (error) {
      setOutputCss('');
      const failureMessage = `Failed to process CSS. ${error.message}`;
      setErrorMessage(failureMessage);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSample = async () => {
    setInputCss(SAMPLE_CSS);
    const success = await runMinify(SAMPLE_CSS);
    if (success) {
      NotificationManager.show('Sample CSS loaded and minified', 2000, { type: 'success' });
    }
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    setInputCss(nextValue);
    if (nextValue === '') {
      setOutputCss('');
      setErrorMessage('');
    }
  };

  const updateOption = (key) => (event) => {
    const checked = Boolean(event.target.checked);
    setOptions((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <div id="css-minifier-tool" className="css-minifier-container tool-container cssm-tool c-tool-stack">
      <div className="o-grid-2col cssm-grid">
        <div className="o-panel cssm-panel cssm-input-panel c-surface-card c-surface-panel">
          <div className="o-panel-header cssm-panel-header c-surface-panel__header">
            <h3>Input CSS</h3>
          </div>
          <textarea
            id="css-minifier-input"
            ref={inputRef}
            className="c-input c-input--textarea c-editor-fill cssm-textarea cssm-input-textarea"
            placeholder="Paste your CSS code here..."
            aria-label="Input CSS"
            value={inputCss}
            onInput={handleInputChange}
          />
          <div
            id="css-minifier-error-status"
            className={`c-input-status cssm-input-status${errorMessage ? ' error' : ''}`}
            role={errorMessage ? 'alert' : 'status'}
            aria-live="polite"
          >
            {errorMessage}
          </div>
        </div>

        <div className="o-panel cssm-panel cssm-output-panel c-surface-card c-surface-panel">
          <div className="o-panel-header cssm-panel-header c-surface-panel__header">
            <h3>Minified Output</h3>
          </div>
          <textarea
            id="css-minifier-output"
            ref={outputRef}
            className={`c-input c-input--textarea c-editor-fill cssm-textarea cssm-output-textarea${isProcessing ? ' processing' : ''}`}
            readOnly
            placeholder="Minified CSS will appear here..."
            aria-label="Minified Output"
            value={outputCss}
          />
        </div>
      </div>

      <div className="css-minifier-actions cssm-actions c-action-strip">
        <button className="c-button c-button--ghost cssm-load-sample-btn" id="load-sample" onClick={() => void handleLoadSample()}>
          Load Sample
        </button>
        <span className="c-toolbar__spacer" />
        <button id="minify-btn" className="c-button cssm-minify-btn" onClick={() => void runMinify()} disabled={isProcessing}>
          {isProcessing ? 'Minifying...' : 'Minify CSS'}
          {!isProcessing && <span className="c-kbd" aria-hidden="true">⌘⏎</span>}
        </button>
      </div>

      <div className="css-minifier-options c-options-panel cssm-options-panel c-surface-card">
        <h3>Minification Options</h3>
        <div className="c-checkbox-group cssm-checkbox-group">
          <div className="c-checkbox-row cssm-checkbox-row">
            <div className="c-checkbox-item c-checkbox-card cssm-checkbox-item">
              <input type="checkbox" id="remove-comments" checked={options.removeComments} onChange={updateOption('removeComments')} />
              <label htmlFor="remove-comments">Remove comments</label>
            </div>
            <div className="c-checkbox-item c-checkbox-card cssm-checkbox-item">
              <input type="checkbox" id="remove-whitespace" checked={options.removeWhitespace} onChange={updateOption('removeWhitespace')} />
              <label htmlFor="remove-whitespace">Remove whitespace</label>
            </div>
            <div className="c-checkbox-item c-checkbox-card cssm-checkbox-item">
              <input type="checkbox" id="combine-selectors" checked={options.combineSelectors} onChange={updateOption('combineSelectors')} />
              <label htmlFor="combine-selectors">Combine duplicate selectors</label>
            </div>
          </div>
          <div className="c-checkbox-row cssm-checkbox-row">
            <div className="c-checkbox-item c-checkbox-card cssm-checkbox-item">
              <input type="checkbox" id="shorten-colors" checked={options.shortenColors} onChange={updateOption('shortenColors')} />
              <label htmlFor="shorten-colors">Shorten color values</label>
            </div>
            <div className="c-checkbox-item c-checkbox-card cssm-checkbox-item">
              <input type="checkbox" id="remove-units" checked={options.removeUnits} onChange={updateOption('removeUnits')} />
              <label htmlFor="remove-units">Remove unnecessary units</label>
            </div>
            <div className="c-checkbox-item c-checkbox-card cssm-checkbox-item">
              <input type="checkbox" id="remove-last-semicolons" checked={options.removeLastSemicolons} onChange={updateOption('removeLastSemicolons')} />
              <label htmlFor="remove-last-semicolons">Remove last semicolons</label>
            </div>
          </div>
        </div>

        <div className="css-minifier-toolbar o-toolbar cssm-options-toolbar">
          <button id="reset-options" className="c-button c-button--secondary cssm-reset-btn" onClick={resetOptions}>
            Reset Options
          </button>
        </div>
      </div>

      <div className="css-minifier-stats c-stats-panel cssm-stats-panel c-surface-card">
        <h3>Statistics</h3>
        <div className="c-stat-row cssm-stat-row">
          <span>Original Size</span>
          <span id="original-size" className="cssm-stat-value">{stats.originalSizeLabel}</span>
        </div>
        <div className="c-stat-row cssm-stat-row">
          <span>Minified Size</span>
          <span id="minified-size" className="cssm-stat-value">{stats.minifiedSizeLabel}</span>
        </div>
        <div className="c-stat-row cssm-stat-row">
          <span>Savings</span>
          <span id="saving" className="css-minifier-saving-percentage">{stats.savingsLabel}</span>
        </div>
      </div>

      <div id="notification" className="c-notification" role="status" aria-live="polite" />

      {/* Tool-first ordering: About intro + guide below the interactive tool. */}
      <CssMinifierIntro />
      <CssMinifierArticle />
    </div>
  );
}

export class CssMinifierToolUI {
  constructor(rootSelector = '#css-minifier-app') {
    const root = document.querySelector(rootSelector) || document.querySelector('#css-minifier-tool');
    if (!root) {
      throw new Error('CSS Minifier root element not found');
    }

    const mount = root.hasChildNodes() ? hydrate : render;
    mount(<CssMinifierApp />, root);
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    mountToolShell({
      title: toolMetadata.title,
      description: toolMetadata.description,
      homeHref: '/'
    });

    new CssMinifierToolUI();
  });
}
