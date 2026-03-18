// Import shared components and styles
import { computeDiff } from './diff';
import ClearButton from '../common/clear-button/ClearButton';
import { NotificationManager } from '../common/notification-manager';
import { scheduleTask } from '../common/scheduler-utils';
import type { ToolCleanupHandle } from '../common/tooling-contracts';
import { hydrate, render } from 'preact';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import toolMetadata from './tool.meta.json';

type PrismRuntime = {
  highlight?: (code: string, grammar: unknown, language: string) => string;
  languages?: Record<string, unknown>;
};

function getPrismRuntime(): PrismRuntime {
  const globalPrism = typeof globalThis !== 'undefined'
    ? (globalThis as typeof globalThis & { Prism?: PrismRuntime }).Prism
    : undefined;
  return globalPrism || Prism;
}

// Class to detect if content is code (used for syntax highlighting)
class CodeDetector {
  static KEYWORDS = ['function', 'const', 'let', 'var', 'import', 'export', 'class', 'return'];
  static CODE_CHARACTERS = ['{', '}', '(', ')', '[', ']', ';', ':', '=', '=>', '.', ','];

  static isCode(textContent) {
    const keywordCount = this.countOccurrences(textContent, this.KEYWORDS);
    const syntaxCharCount = this.countOccurrences(textContent, this.CODE_CHARACTERS);
    return keywordCount > 2 || syntaxCharCount > 5;
  }

  static countOccurrences(textContent, searchPatterns) {
    return searchPatterns.reduce((totalCount, pattern) =>
      totalCount + (textContent.split(pattern).length - 1), 0);
  }
}

// Class to handle the diff display
class DiffDisplay {
  diffResultElement: HTMLElement;
  originalLineNumber: number;
  modifiedLineNumber: number;

  constructor(diffResultElement: HTMLElement) {
    this.diffResultElement = diffResultElement;
    this.originalLineNumber = 1;
    this.modifiedLineNumber = 1;
  }

  displayDiff(diffResults, isCodeContent) {
    this.diffResultElement.innerHTML = '';
    diffResults.forEach(([changeType, lineContent]) => {
      const lineElement = this.createLineElement(changeType, lineContent, isCodeContent);
      this.diffResultElement.appendChild(lineElement);
    });
  }

  // Helper function to escape HTML but preserve word-level diff spans
  escapeHtmlPreserveDiff(html) {
    // If the content already has word-level diff spans, we need to handle them specially
    if (html.includes('class="word-added"') || html.includes('class="word-removed"')) {
      // Split the string by the opening and closing tags of word-level diff spans
      const parts = [];
      let currentIndex = 0;

      // Regular expression to match word-level diff spans
      const spanRegex = /(<span class="word-(added|removed)">(.*?)<\/span>)/g;
      let match;

      while ((match = spanRegex.exec(html)) !== null) {
        // Add the text before the span (escaped)
        if (match.index > currentIndex) {
          const textBefore = html.substring(currentIndex, match.index);
          parts.push(this.escapeHtml(textBefore));
        }

        // Preserve the diff span wrapper but escape its inner content so code/HTML
        // inside word-level diffs is displayed as text instead of becoming live DOM.
        const diffType = match[2];
        const spanContent = match[3];
        parts.push(`<span class="word-${diffType}">${this.escapeHtml(spanContent)}</span>`);

        // Update the current index
        currentIndex = match.index + match[0].length;
      }

      // Add any remaining text after the last span (escaped)
      if (currentIndex < html.length) {
        const textAfter = html.substring(currentIndex);
        parts.push(this.escapeHtml(textAfter));
      }

      return parts.join('');
    }

    // If no word-level diff spans, escape all HTML
    return this.escapeHtml(html);
  }

  // Basic HTML escaping function
  escapeHtml(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Updated createLineElement to separate line number and content spans
  // Pass changeType to formatLine
  createLineElement(changeType, lineContent, isCodeContent) {
    const lineContainer = document.createElement('div');
    const lineNumberElement = document.createElement('span');

    let contentElement;
    if (changeType === 'added') {
      contentElement = document.createElement('ins');
    } else if (changeType === 'removed') {
      contentElement = document.createElement('del');
    } else {
      contentElement = document.createElement('span');
    }

    const lineNumbersContent = this.getLineNumberText(changeType);
    lineNumberElement.className = 'diff-line-number';
    lineNumberElement.textContent = lineNumbersContent;

    // All content formatting is now handled by formatLine
    // Pass changeType to formatLine
    contentElement.innerHTML = this.formatLine(lineContent, isCodeContent, changeType);

    contentElement.classList.add('diff-content');
    if (changeType !== 'unchanged') {
      contentElement.classList.add(`diff-${changeType}`);
    }

    lineContainer.appendChild(lineNumberElement);
    lineContainer.appendChild(contentElement);
    lineContainer.classList.add('diff-line');

    return lineContainer;
  }

  /**
   * Formats a line of content for the diff view.
   * @param {string} lineContent - The content of the line.
   * @param {boolean} isCodeContent - Whether the line contains code content.
   * @param {string} changeType - The type of change for the line. Expected values are:
   *   - 'added': The line was added.
   *   - 'removed': The line was removed.
   *   - 'unchanged': The line is unchanged.
   * @returns {string} The formatted line content, with appropriate HTML and syntax highlighting.
   */
  formatLine(lineContent, isCodeContent, changeType) {
    // Only apply Prism highlighting if the line is unchanged and it's code content
    if (changeType === 'unchanged' && isCodeContent) {
      try {
        const prismRuntime = getPrismRuntime();
        // Ensure Prism is available
        if (prismRuntime.languages && prismRuntime.languages.javascript && prismRuntime.highlight) {
          return prismRuntime.highlight(lineContent, prismRuntime.languages.javascript, 'javascript') + '\n';
        } else {
          console.warn('Prism.js or javascript language not available. Falling back to escaped HTML.');
          // Fallback for Prism errors or unavailability: escaped HTML
          return this.escapeHtml(lineContent) + '\n';
        }
      } catch (error) {
        console.warn('Syntax highlighting failed:', error);
        // Fallback for Prism errors: escaped HTML
        return this.escapeHtml(lineContent) + '\n';
      }
    } else {
      // For added, removed, or non-code lines, or lines with word diffs (handled by escapeHtmlPreserveDiff)
      // Use escapeHtmlPreserveDiff to handle potential word-diff spans correctly
      return this.escapeHtmlPreserveDiff(lineContent) + '\n';
    }
  }

  createLineNumberHTML(changeType) {
    return this.getLineNumberText(changeType, 0);
  }

  formatLineNumbers(originalNum, modifiedNum, maxDigits) {
    const originalStr = originalNum
      ? originalNum.toString().padStart(maxDigits, ' ')
      : ''.padStart(maxDigits, ' ');
    const modifiedStr = modifiedNum
      ? modifiedNum.toString().padStart(maxDigits, ' ')
      : ''.padStart(maxDigits, ' ');
    // Return only the text content, not the span tag
    return `${originalStr}│${modifiedStr}`;
  }

  // Renamed from createLineNumberHTML to getLineNumberText to reflect it returns text
  getLineNumberText(changeType, minDigits = 3) {
    // Ensure minimum width for alignment, calculate max digits needed
    // This calculation might need refinement based on total lines, but is a start
    const maxDigits = Math.max(
      this.originalLineNumber.toString().length,
      this.modifiedLineNumber.toString().length,
      minDigits // Ensure a minimum width visually
    );

    let lineNumbersContent = '';
    switch (changeType) {
      case 'added':
        lineNumbersContent = this.formatLineNumbers('', this.modifiedLineNumber++, maxDigits);
        break;
      case 'removed':
        lineNumbersContent = this.formatLineNumbers(this.originalLineNumber++, '', maxDigits);
        break;
      default: // unchanged
        lineNumbersContent = this.formatLineNumbers(this.originalLineNumber++, this.modifiedLineNumber++, maxDigits);
    }
    return lineNumbersContent;
  }
}

// Class to handle diff navigation
class DiffNavigator {
  resultElement: HTMLElement;
  prevButton: HTMLButtonElement | null;
  nextButton: HTMLButtonElement | null;
  counterElement: HTMLElement | null;
  diffElements: HTMLElement[][];
  currentDiffIndex: number;

  constructor(resultElement: HTMLElement, prevButton: HTMLButtonElement | null, nextButton: HTMLButtonElement | null, counterElement: HTMLElement | null) {
    this.resultElement = resultElement;
    this.prevButton = prevButton;
    this.nextButton = nextButton;
    this.counterElement = counterElement;
    this.diffElements = [];
    this.currentDiffIndex = -1;

    this._bindEvents();
  }

  _bindEvents() {
    if (this.prevButton) {
      this.prevButton.addEventListener('click', () => this.navigateToPrevious());
    }
    if (this.nextButton) {
      this.nextButton.addEventListener('click', () => this.navigateToNext());
    }
  }

  updateDiffElements() {
    this.diffElements = [];
    let currentBlock = [];
    const allDiffLines = Array.from(this.resultElement.querySelectorAll('.diff-line')) as HTMLElement[];
    for (const line of allDiffLines) {
      const hasDiff = line.querySelector('.diff-added, .diff-removed');
      if (hasDiff) {
        currentBlock.push(line);
      } else {
        if (currentBlock.length > 0) {
          this.diffElements.push(currentBlock);
          currentBlock = [];
        }
      }
    }
    if (currentBlock.length > 0) {
      this.diffElements.push(currentBlock);
    }
    this.reset();
  }

  reset() {
    // Remove any existing highlight
    this.resultElement.querySelectorAll('.current-diff').forEach(el => el.classList.remove('current-diff'));
    this.currentDiffIndex = -1;
    this.updateNavigationState();
  }

  updateNavigationState() {
    const totalDiffs = this.diffElements.length;

    if (!this.counterElement || !this.prevButton || !this.nextButton) return;

    if (totalDiffs === 0) {
      this.counterElement.textContent = '0 of 0';
      this.prevButton.disabled = true;
      this.nextButton.disabled = true;
      return;
    }

    // Display 1-based index for user
    this.counterElement.textContent = `${this.currentDiffIndex + 1} of ${totalDiffs}`;
    this.prevButton.disabled = this.currentDiffIndex <= 0;
    this.nextButton.disabled = this.currentDiffIndex >= totalDiffs - 1;
  }

  navigateToIndex(index) {
    if (index < 0 || index >= this.diffElements.length) {
      return; // Invalid index
    }

    // Remove highlight from the previous block
    if (this.currentDiffIndex !== -1 && this.diffElements[this.currentDiffIndex]) {
      this.diffElements[this.currentDiffIndex].forEach(el => {
        el.classList.remove('current-diff-single', 'current-diff-start', 'current-diff-middle', 'current-diff-end');
      });
    }

    this.currentDiffIndex = index;

    // Add highlight to the current block
    const currentBlock = this.diffElements[this.currentDiffIndex];
    if (currentBlock && currentBlock.length > 0) {
      if (currentBlock.length === 1) {
        currentBlock[0].classList.add('current-diff-single');
      } else {
        currentBlock[0].classList.add('current-diff-start');
        for (let i = 1; i < currentBlock.length - 1; i++) {
          currentBlock[i].classList.add('current-diff-middle');
        }
        currentBlock[currentBlock.length - 1].classList.add('current-diff-end');
      }
      // Scroll to the first element in the block
      currentBlock[0].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }

    this.updateNavigationState();
  }

  navigateToPrevious() {
    if (this.currentDiffIndex > 0) {
      this.navigateToIndex(this.currentDiffIndex - 1);
    }
  }

  navigateToNext() {
    if (this.currentDiffIndex < this.diffElements.length - 1) {
      this.navigateToIndex(this.currentDiffIndex + 1);
    }
  }
}


// Main event handler
export function initializeDiffChecker(): ToolCleanupHandle | void {
  if (typeof document === 'undefined') return;

  const compareButton = document.getElementById('compare-button') as HTMLButtonElement | null;
  const text1 = document.getElementById('text1') as HTMLTextAreaElement | null;
  const text2 = document.getElementById('text2') as HTMLTextAreaElement | null;
  const diffResultElement = document.getElementById('diff-result') as HTMLElement | null;
  if (!diffResultElement) {
    return;
  }

  // Instantiate the navigator
  const diffNavigator = new DiffNavigator(
    diffResultElement,
    document.getElementById('prev-diff-button') as HTMLButtonElement | null,
    document.getElementById('next-diff-button') as HTMLButtonElement | null,
    document.getElementById('diff-counter')
  );

  // Initialize clear buttons with cleanup support
  let clearButton1: ClearButton | null = null;
  let clearButton2: ClearButton | null = null;

  // Cleanup function to disconnect clear buttons
  /* istanbul ignore next */
  const cleanup = () => {
    if (clearButton1) {
      clearButton1.disconnect();
      clearButton1 = null;
    }
    if (clearButton2) {
      clearButton2.disconnect();
      clearButton2 = null;
    }
  };


  // Handle page unload
  window.addEventListener('unload', cleanup);

  /* istanbul ignore next */
  if (text1 && text2) {
    clearButton1 = new ClearButton(text1);
    clearButton2 = new ClearButton(text2);
  }

  if (compareButton && text1 && text2) {
    compareButton.addEventListener('click', async function () {
      const originalText = text1.value;
      const modifiedText = text2.value;

      if (!originalText && !modifiedText) {
        NotificationManager.show('Please enter text in at least one of the fields');
        return;
      }

      // UI Feedback: Show loading state
      compareButton.textContent = 'Computing Diff...';
      compareButton.disabled = true;

      try {
        // Yield to main thread
        await scheduleTask(20);

        const originalLines = originalText.split('\n');
        const modifiedLines = modifiedText.split('\n');

        const isCodeContent = CodeDetector.isCode(originalText) || CodeDetector.isCode(modifiedText);
        const ignoreWhitespaceToggle = document.getElementById('ignore-whitespace') as HTMLInputElement | null;
        const ignoreWhitespace = ignoreWhitespaceToggle?.checked ?? true;
        const diffResults = computeDiff(originalLines, modifiedLines, ignoreWhitespace);

        const diffDisplay = new DiffDisplay(diffResultElement);
        diffDisplay.displayDiff(diffResults, isCodeContent);

        // Update the navigator with the new diff elements
        diffNavigator.updateDiffElements();

        // Show notification
        NotificationManager.show('Diff computation complete!');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        NotificationManager.show('Error computing diff: ' + errorMessage);
        console.error(error);
      } finally {
        // Restore UI state
        compareButton.textContent = 'Compare';
        compareButton.disabled = false;
      }
    });
  }

  // Export cleanup function for testing
  const browserWindow = window as Window & { diffCheckerCleanup?: ToolCleanupHandle['cleanup'] };
  browserWindow.diffCheckerCleanup = cleanup;
  return { cleanup };
}

export function DiffCheckerApp() {
  return (
    <div id="diff-checker-tool" className="tool-container diffc-tool c-tool-stack">
      <div className="o-header c-tool-header c-surface-card">
        <p className="o-description c-tool-description">Compare two texts or code snippets and highlight the differences between them.</p>
      </div>

      <div className="o-grid-2col diffc-grid">
        <div className="o-panel diffc-panel c-surface-card c-surface-panel">
          <div className="diff-checker-panel-header diffc-panel-header c-surface-panel__header">
            <h3>Original Text</h3>
            <div className="o-toolbar diffc-panel-toolbar c-panel-toolbar" />
          </div>
          <div className="o-panel-content diffc-panel-content c-surface-panel__content c-surface-panel__content--flush">
            <textarea
              id="text1"
              className="c-input c-input--textarea c-editor-fill diffc-textarea diffc-textarea--original"
              placeholder="Paste your first text here..."
              title="Enter your original text or code here"
              aria-label="Original text input"
            />
          </div>
        </div>

        <div className="o-panel diffc-panel c-surface-card c-surface-panel">
          <div className="diff-checker-panel-header diffc-panel-header c-surface-panel__header">
            <h3>Modified Text</h3>
            <div className="o-toolbar diffc-panel-toolbar c-panel-toolbar" />
          </div>
          <div className="o-panel-content diffc-panel-content c-surface-panel__content c-surface-panel__content--flush">
            <textarea
              id="text2"
              className="c-input c-input--textarea c-editor-fill diffc-textarea diffc-textarea--modified"
              placeholder="Paste your second text here..."
              title="Enter your modified text or code here"
              aria-label="Modified text input"
            />
          </div>
        </div>
      </div>

      <div className="o-controls diff-checker-options diffc-options c-action-strip">
        <div className="c-checkbox-group diffc-checkbox-group">
          <div className="c-checkbox-item c-checkbox-card diffc-checkbox-item">
            <input type="checkbox" id="ignore-whitespace" defaultChecked />
            <label htmlFor="ignore-whitespace">Ignore whitespace differences</label>
          </div>
        </div>

        <div className="o-toolbar diffc-options-toolbar">
          <button id="compare-button" className="c-button diffc-compare-button" type="button">Compare</button>
        </div>
      </div>

      <div id="diff-result-container" className="o-panel diffc-result-panel c-surface-card c-surface-panel">
        <div className="diff-result-header diffc-result-header">
          <h3>Differences</h3>
          <div className="diff-navigation diffc-navigation">
            <button
              id="prev-diff-button"
              className="c-button c-button--secondary c-button--small"
              type="button"
              disabled
              aria-label="Go to previous difference"
            >
              {'< Prev'}
            </button>
            <span id="diff-counter" aria-live="polite" aria-atomic="true">0 of 0</span>
            <button
              id="next-diff-button"
              className="c-button c-button--secondary c-button--small"
              type="button"
              disabled
              aria-label="Go to next difference"
            >
              {'Next >'}
            </button>
          </div>
        </div>
        <div className="o-panel-content diffc-result-panel-content">
          <pre
            id="diff-result"
            className="c-code-output diffc-result-output"
            tabIndex={0}
          />
        </div>
      </div>

      <div id="notification" className="c-notification" role="status" aria-live="polite">Copied to clipboard!</div>
    </div>
  );
}

function initializeDiffCheckerDom() {
  return initializeDiffChecker();
}

export class DiffCheckerToolUI {
  instance: ReturnType<typeof initializeDiffCheckerDom> | undefined;

  constructor(rootSelector = '#diff-checker-app') {
    const root = document.querySelector(rootSelector) || document.querySelector('#diff-checker-tool');
    if (!root) {
      throw new Error('Diff Checker root element not found');
    }

    const mount = root.hasChildNodes() ? hydrate : render;
    mount(<DiffCheckerApp />, root);
    this.instance = initializeDiffCheckerDom();
  }
}

function bootstrapDiffCheckerPage() {
  mountToolShell({
    title: toolMetadata.title,
    description: toolMetadata.description,
    homeHref: '/'
  });

  const hasAppRoot = Boolean(document.getElementById('diff-checker-app') || document.getElementById('diff-checker-tool'));
  if (hasAppRoot) {
    try {
      new DiffCheckerToolUI();
      return;
    } catch (error) {
      console.error('Diff checker UI bootstrap failed:', error);
    }
  }

  initializeDiffCheckerDom();
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', bootstrapDiffCheckerPage);
}

// Export classes/functions needed for testing or potentially other modules
export { computeDiff, DiffDisplay, DiffNavigator, CodeDetector };
