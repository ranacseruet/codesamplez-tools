// Import shared components and styles
import { computeDiff, type DiffComputeRequest, type DiffComputeResult } from './diff';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { NotificationManager } from '../common/notification-manager';
import { scheduleTask } from '../common/scheduler-utils';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { registerDropZone, registerFileInput, type DropZoneCleanup } from '../common/drop-zone';
import FileUploadButton, { TEXT_FILE_ACCEPT } from '../common/file-upload';
import { copyTextToClipboard } from '../common/clipboard';
import type { DiffSharePayload } from './share-url';
import { trackOptionsHeight } from './sticky-offset';
import { createLazyRunner } from '../common/lazy-runner';
import type { ToolCleanupHandle } from '../common/tooling-contracts';
import { hydrate, render } from 'preact';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import toolMetadata from './tool.meta.json';

/**
 * Combined input length (original + modified, in characters) at or below which
 * the diff is computed synchronously on the main thread: the work is cheap and
 * a worker round-trip would only add latency. Above it, `computeDiff` is
 * offloaded to a Web Worker (with a main-thread fallback) so a large compare
 * does not block interaction (INP). Kept in this module — not in diff-runner —
 * so the SSR/prerender graph never imports the worker module, which uses
 * `import.meta.url` and must only be evaluated in the browser.
 */
const DIFF_WORKER_CHAR_THRESHOLD = 20_000;
const CARRIAGE_RETURN_MARKER = '\u240d';

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Split exact-mode input into logical lines while keeping carriage returns on
 * the line they terminate. That lets the renderer show CRLF/CR differences
 * without handing a raw carriage return to the HTML parser.
 */
function splitExactLines(text: string): string[] {
  const lines: string[] = [];
  let lineStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\r') {
      if (text[index + 1] === '\n') continue;
      lines.push(`${text.slice(lineStart, index)}\r`);
      lineStart = index + 1;
      continue;
    }

    if (text[index] === '\n') {
      const hasCarriageReturn = index > lineStart && text[index - 1] === '\r';
      const lineEnd = hasCarriageReturn ? index - 1 : index;
      lines.push(`${text.slice(lineStart, lineEnd)}${hasCarriageReturn ? '\r' : ''}`);
      lineStart = index + 1;
    }
  }

  lines.push(text.slice(lineStart));
  return lines;
}

function splitLines(text: string, ignoreWhitespace: boolean): string[] {
  return ignoreWhitespace
    ? normalizeLineEndings(text).split('\n')
    : splitExactLines(text);
}

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
    if (html.indexOf('class="word-added"') !== -1 || html.indexOf('class="word-removed"') !== -1) {
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
    // A carriage return is a meaningful diff input when whitespace is not
    // ignored. Show it explicitly instead of writing it to the HTML container,
    // whose parser normalizes it to a newline and creates an extra visual row.
    const displayLineContent = lineContent.replace(/\r/g, CARRIAGE_RETURN_MARKER);

    // Only apply Prism highlighting if the line is unchanged and it's code content
    if (changeType === 'unchanged' && isCodeContent) {
      try {
        const prismRuntime = getPrismRuntime();
        // Ensure Prism is available
        if (prismRuntime.languages && prismRuntime.languages.javascript && prismRuntime.highlight) {
          return prismRuntime.highlight(displayLineContent, prismRuntime.languages.javascript, 'javascript') + '\n';
        } else {
          console.warn('Prism.js or javascript language not available. Falling back to escaped HTML.');
          // Fallback for Prism errors or unavailability: escaped HTML
          return this.escapeHtml(displayLineContent) + '\n';
        }
      } catch (error) {
        console.warn('Syntax highlighting failed:', error);
        // Fallback for Prism errors: escaped HTML
        return this.escapeHtml(displayLineContent) + '\n';
      }
    } else {
      // For added, removed, or non-code lines, or lines with word diffs (handled by escapeHtmlPreserveDiff)
      // Use escapeHtmlPreserveDiff to handle potential word-diff spans correctly
      return this.escapeHtmlPreserveDiff(displayLineContent) + '\n';
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
  const diffEmptyState = document.getElementById('diff-empty-state');
  const diffErrorStatus = document.getElementById('diff-error-status');
  if (!diffResultElement) {
    return;
  }

  // One-click copy for the rendered diff output (CopyButton targets <pre>).
  const resultCopyButton = diffResultElement instanceof HTMLPreElement
    ? new CopyButton(diffResultElement)
    : null;

  // `textContent` on the primary button would destroy its `.c-kbd` hint child;
  // swap only the leading text node instead.
  const setPrimaryButtonLabel = (text: string) => {
    /* istanbul ignore next */
    if (!compareButton) return;
    const first = compareButton.firstChild;
    if (first && first.nodeType === 3 /* Node.TEXT_NODE */) {
      first.textContent = text;
    } else {
      compareButton.textContent = text;
    }
  };

  const setInlineError = (message: string) => {
    if (!diffErrorStatus) return;
    diffErrorStatus.textContent = message;
    diffErrorStatus.classList.toggle('error', message.length > 0);
  };

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
  const dropZoneCleanups: DropZoneCleanup[] = [];
  // Textarea.value normalizes CRLF and CR to LF. Keep the source text for
  // file drops and share payloads, then discard it as soon as the user edits
  // that pane so the comparison always reflects the visible input.
  const rawTextByPane = new WeakMap<HTMLTextAreaElement, string>();
  const paneInputCleanups: Array<() => void> = [];

  const rememberPaneText = (pane: HTMLTextAreaElement, text: string) => {
    rawTextByPane.set(pane, text);
    pane.value = text;
  };

  const getPaneText = (pane: HTMLTextAreaElement): string => {
    const rawText = rawTextByPane.get(pane);
    if (rawText !== undefined && normalizeLineEndings(rawText) === pane.value) {
      return rawText;
    }
    return pane.value;
  };

  const trackPaneInput = (pane: HTMLTextAreaElement) => {
    const clearRawText = () => rawTextByPane.delete(pane);
    pane.addEventListener('input', clearRawText);
    paneInputCleanups.push(() => pane.removeEventListener('input', clearRawText));
  };

  // Web Worker runner for large diffs. Lazily imports the runner chunk on first
  // over-threshold compare (keeping the worker out of the main bundle) and
  // falls back to a direct main-thread computeDiff if that chunk fails to load.
  const diffRunner = createLazyRunner<DiffComputeRequest, DiffComputeResult>(
    () => import('./diff-runner').then((module) => module.createDiffRunner),
    ({ originalLines, modifiedLines, ignoreWhitespace }) =>
      computeDiff(originalLines, modifiedLines, ignoreWhitespace) as DiffComputeResult
  );

  // Keep the result header's sticky offset equal to the options strip's real
  // height instead of a hard-coded per-breakpoint guess.
  const stopTrackingOptionsHeight = trackOptionsHeight(
    document.querySelector<HTMLElement>('.diffc-options'),
    document.querySelector<HTMLElement>('.diffc-tool')
  );

  // Cleanup function to disconnect clear buttons
  /* istanbul ignore next */
  const cleanup = () => {
    stopTrackingOptionsHeight();
    if (clearButton1) {
      clearButton1.disconnect();
      clearButton1 = null;
    }
    if (clearButton2) {
      clearButton2.disconnect();
      clearButton2 = null;
    }
    resultCopyButton?.disconnect();
    diffRunner.terminate();
    paneInputCleanups.splice(0).forEach((disposeInputTracking) => disposeInputTracking());
    dropZoneCleanups.splice(0).forEach((disposeDropZone) => disposeDropZone());
  };


  // Tear down on page hide rather than `unload`. Chrome blocks `unload` under a
  // default permissions policy (it logs "Permissions policy violation: unload is
  // not allowed in this document"), and registering one also disqualifies the
  // page from the back/forward cache — so the deprecated event cost a bfcache
  // restore on every visit while doing nothing the browser would not do anyway.
  //
  // `event.persisted` means the page is going *into* the bfcache and can be
  // restored with its DOM and JS state intact; tearing down the clear/copy
  // buttons and the diff worker there would hand the user a dead tool on
  // restore, so that case is deliberately left alone.
  window.addEventListener('pagehide', (event: PageTransitionEvent) => {
    if (event.persisted) return;
    cleanup();
  });

  /* istanbul ignore next */
  if (text1 && text2) {
    clearButton1 = new ClearButton(text1);
    clearButton2 = new ClearButton(text2);
  }

  const SAMPLE_ORIGINAL = `function greet(name) {
  console.log('Hello, ' + name);
  return true;
}`;

  const SAMPLE_MODIFIED = `function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return true;
}`;

  // Two-pane sample: fills both inputs so a first-time visitor sees a real diff.
  const loadSampleButton = document.getElementById('load-sample') as HTMLButtonElement | null;
  if (loadSampleButton && text1 && text2 && compareButton) {
    loadSampleButton.addEventListener('click', () => {
      rememberPaneText(text1, SAMPLE_ORIGINAL);
      rememberPaneText(text2, SAMPLE_MODIFIED);
      clearButton1?.updateVisibility();
      clearButton2?.updateVisibility();
      compareButton.click();
    });
  }

  // Each pane is its own drop target, so comparing two files is two drops.
  // Unlike the single-input tools this deliberately does not auto-compare:
  // after the first drop only one side is filled, and running a compare
  // against an empty pane would just render the whole file as an insertion.
  const registerPaneFileLoading = (
    pane: HTMLTextAreaElement,
    fileInputId: string,
    getClearButton: () => ClearButton | null
  ) => {
    const fileOptions = {
      onText: (text: string, file: File) => {
        rememberPaneText(pane, text);
        getClearButton()?.updateVisibility();
        setInlineError('');
        NotificationManager.show(`Loaded ${file.name}`, 2000, { type: 'success' });
      },
      onError: (message: string) => NotificationManager.show(message, 3000, { type: 'error' as const })
    };

    dropZoneCleanups.push(registerDropZone(pane, fileOptions));

    const fileInput = document.getElementById(fileInputId);
    if (fileInput instanceof HTMLInputElement) {
      dropZoneCleanups.push(registerFileInput(fileInput, fileOptions));
    }
  };

  if (text1) {
    registerPaneFileLoading(text1, 'diff-checker-original-file', () => clearButton1);
  }
  if (text2) {
    registerPaneFileLoading(text2, 'diff-checker-modified-file', () => clearButton2);
  }
  if (text1) {
    trackPaneInput(text1);
  }
  if (text2) {
    trackPaneInput(text2);
  }

  if (compareButton && text1 && text2) {
    registerPrimaryActionShortcut(compareButton);
    compareButton.addEventListener('click', async function () {
      const originalText = getPaneText(text1);
      const modifiedText = getPaneText(text2);

      if (!originalText && !modifiedText) {
        setInlineError('Please enter text in at least one of the fields');
        return;
      }
      setInlineError('');

      // UI Feedback: Show loading state (first-text-node swap keeps `.c-kbd`)
      setPrimaryButtonLabel('Computing Diff...');
      compareButton.disabled = true;

      try {
        // Yield to main thread
        await scheduleTask(20);

        const isCodeContent = CodeDetector.isCode(originalText) || CodeDetector.isCode(modifiedText);
        const ignoreWhitespaceToggle = document.getElementById('ignore-whitespace') as HTMLInputElement | null;
        const ignoreWhitespace = ignoreWhitespaceToggle?.checked ?? true;

        const originalLines = splitLines(originalText, ignoreWhitespace);
        const modifiedLines = splitLines(modifiedText, ignoreWhitespace);

        // Small compares run synchronously (cheap, no worker round-trip);
        // large ones are offloaded to the worker. DOM rendering below always
        // stays on the main thread.
        const diffResults = (originalText.length + modifiedText.length) <= DIFF_WORKER_CHAR_THRESHOLD
          ? computeDiff(originalLines, modifiedLines, ignoreWhitespace)
          : await diffRunner.run({ originalLines, modifiedLines, ignoreWhitespace });

        if (diffEmptyState) {
          diffEmptyState.style.display = 'none';
        }
        const diffDisplay = new DiffDisplay(diffResultElement);
        diffDisplay.displayDiff(diffResults, isCodeContent);

        // Update the navigator with the new diff elements
        diffNavigator.updateDiffElements();

        // Show notification
        NotificationManager.show('Diff computation complete!');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setInlineError('Error computing diff: ' + errorMessage);
        console.error(error);
      } finally {
        // Restore UI state (first-text-node swap keeps `.c-kbd`)
        setPrimaryButtonLabel('Compare');
        compareButton.disabled = false;
      }
    });
  }

  const ignoreWhitespaceToggle = document.getElementById('ignore-whitespace') as HTMLInputElement | null;

  /**
   * Copy a shareable link carrying both panes plus the whitespace option,
   * LZ-compressed into the hash fragment so the compared text never reaches a
   * server. Mirrors json-formatter's Share: guarded against an empty compare
   * and against payloads too long to paste anywhere useful.
   */
  const shareDiffUrl = async () => {
    if (!text1 || !text2) return;

    if (!text1.value.trim() && !text2.value.trim()) {
      NotificationManager.show('Enter text in at least one pane before sharing.', 3000, { type: 'error' });
      return;
    }

    const payload: DiffSharePayload = {
      original: getPaneText(text1),
      modified: getPaneText(text2),
      ignoreWhitespace: ignoreWhitespaceToggle?.checked ?? true
    };
    const { buildShareUrl, SHARE_URL_MAX_LENGTH } = await import('./share-url');
    const url = buildShareUrl(window.location.href, payload);

    if (url.length > SHARE_URL_MAX_LENGTH) {
      NotificationManager.show(
        `These texts are too large to share as a URL (limit ~${SHARE_URL_MAX_LENGTH} characters).`,
        4000,
        { type: 'error' }
      );
      return;
    }

    try {
      await copyTextToClipboard(url);
      NotificationManager.show('Share link copied to clipboard!', 2000, { type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      NotificationManager.show(`Failed to copy share link. ${message}`, 3000, { type: 'error' });
    }
  };

  const shareButton = document.getElementById('diff-share-button') as HTMLButtonElement | null;
  if (shareButton) {
    shareButton.addEventListener('click', () => void shareDiffUrl());
  }

  /**
   * Preload both panes from a shared link and run the compare immediately —
   * unlike a dropped file (which fills one pane at a time), a share link
   * always carries both sides, so there is nothing to wait for.
   */
  const loadFromShareLocation = async (locationLike: Pick<Location, 'hash' | 'search'>) => {
    // Probe for the param before importing the share module: it pulls
    // lz-string, and only the few visitors arriving via a share link need it.
    // The literal must match `HASH_PARAM` in ./share-url (pinned by a test).
    const hashValue = locationLike.hash.startsWith('#') ? locationLike.hash.slice(1) : locationLike.hash;
    const carriesPayload =
      new URLSearchParams(hashValue).get('d') !== null ||
      new URLSearchParams(locationLike.search).get('d') !== null;
    if (!carriesPayload || !text1 || !text2) return;

    // Snapshot both panes across the await: on a slow chunk request the user
    // can start typing before the codec arrives, and applying the payload then
    // would replace their text and kick off a compare they did not ask for.
    const originalBeforeLoad = text1.value;
    const modifiedBeforeLoad = text2.value;

    const { resolveSharePayload } = await import('./share-url');
    if (text1.value !== originalBeforeLoad || text2.value !== modifiedBeforeLoad) return;

    const { payload, source } = resolveSharePayload(locationLike);
    if (!payload) return;

    rememberPaneText(text1, payload.original);
    rememberPaneText(text2, payload.modified);
    clearButton1?.updateVisibility();
    clearButton2?.updateVisibility();
    if (ignoreWhitespaceToggle) {
      ignoreWhitespaceToggle.checked = payload.ignoreWhitespace;
    }
    setInlineError('');
    compareButton?.click();
    NotificationManager.show('Loaded texts from shared link.', 2000, { type: 'success' });

    if (source === 'query') {
      NotificationManager.show(
        'Legacy ?d= preload detected. Prefer #d= to avoid leaking content in URLs.',
        4000,
        { type: 'warning' }
      );
    }
  };

  void loadFromShareLocation(window.location);

  // Export cleanup function for testing
  const browserWindow = window as Window & { diffCheckerCleanup?: ToolCleanupHandle['cleanup'] };
  browserWindow.diffCheckerCleanup = cleanup;
  return { cleanup };
}

export function DiffCheckerApp() {
  return (
    <div id="diff-checker-tool" className="tool-container diffc-tool c-tool-stack">
      <div className="o-grid-2col diffc-grid">
        <div className="o-panel diffc-panel c-surface-card c-surface-panel">
          <div className="diff-checker-panel-header diffc-panel-header c-surface-panel__header">
            <h3>Original Text</h3>
            <FileUploadButton
              id="diff-checker-original-file"
              className="c-button c-button--secondary c-button--small diffc-upload-button"
              accept={TEXT_FILE_ACCEPT}
              ariaLabel="Upload file for original text"
            />
          </div>
          <div className="o-panel-content diffc-panel-content c-surface-panel__content c-surface-panel__content--flush">
            <textarea
              id="text1"
              className="c-input c-input--textarea c-editor-fill diffc-textarea diffc-textarea--original"
              placeholder="Paste your first text here, or drop a file..."
              title="Enter your original text or code here"
              aria-label="Original text input"
            />
          </div>
        </div>

        <div className="o-panel diffc-panel c-surface-card c-surface-panel">
          <div className="diff-checker-panel-header diffc-panel-header c-surface-panel__header">
            <h3>Modified Text</h3>
            <FileUploadButton
              id="diff-checker-modified-file"
              className="c-button c-button--secondary c-button--small diffc-upload-button"
              accept={TEXT_FILE_ACCEPT}
              ariaLabel="Upload file for modified text"
            />
          </div>
          <div className="o-panel-content diffc-panel-content c-surface-panel__content c-surface-panel__content--flush">
            <textarea
              id="text2"
              className="c-input c-input--textarea c-editor-fill diffc-textarea diffc-textarea--modified"
              placeholder="Paste your second text here, or drop a file..."
              title="Enter your modified text or code here"
              aria-label="Modified text input"
            />
          </div>
        </div>
      </div>

      <div className="o-controls diff-checker-options diffc-options c-action-strip">
        <button id="load-sample" className="c-button c-button--ghost diffc-load-sample-btn" type="button">Load Sample</button>
        <div className="c-checkbox-group diffc-checkbox-group">
          <div className="c-checkbox-item c-checkbox-card diffc-checkbox-item">
            <input type="checkbox" id="ignore-whitespace" defaultChecked />
            <label htmlFor="ignore-whitespace">Ignore whitespace differences</label>
          </div>
        </div>

        <button
          id="diff-share-button"
          className="c-button c-button--secondary c-button--icon-share diffc-share-button"
          type="button"
        >
          Share
        </button>

        <span className="c-toolbar__spacer" />
        <button id="compare-button" className="c-button diffc-compare-button" type="button">
          Compare
          <span className="c-kbd" aria-hidden="true">⌘⏎</span>
        </button>
      </div>
      <div id="diff-error-status" className="c-input-status diffc-error-status" role="status" aria-live="polite" />

      <div id="diff-result-container" className="o-panel diffc-result-panel c-surface-card c-surface-panel">
        <div className="diff-result-header diffc-result-header c-surface-panel__header">
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
          <div id="diff-empty-state" className="c-empty-state">
            <span className="c-empty-state__icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6M9 17h6" />
              </svg>
            </span>
            <p className="c-empty-state__message">Differences will appear here</p>
            <p className="c-empty-state__hint">Paste both texts or load the sample, then run Compare.</p>
          </div>
          <pre
            id="diff-result"
            className="c-code-output diffc-result-output"
            tabIndex={0}
          />
        </div>
      </div>

      <div id="notification" className="c-notification" role="status" aria-live="polite" />
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
