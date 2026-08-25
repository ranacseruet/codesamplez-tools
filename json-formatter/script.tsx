import { NotificationManager } from '../common/notification-manager';
import { formatBytes } from '../common/format-utils';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import { scheduleTask, nextFrame } from '../common/scheduler-utils';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { registerDropZone } from '../common/drop-zone';
import { copyTextToClipboard } from '../common/clipboard';
import { createLazyRunner, type LazyRunner } from '../common/lazy-runner';
import {
  autoFixJSON,
  formatJson,
  locateJsonError,
  parseIndentOption,
  sortKeysAlphabetically,
  type IndentOption,
  type JsonFormatRequest,
  type JsonFormatResult
} from './json-format-core';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { buildShareUrl, resolveSharePayload, SHARE_URL_MAX_LENGTH, type ShareUrlPayload } from './share-url';
import toolMetadata from './tool.meta.json';

/**
 * Trimmed input length (characters) at or below which formatting runs
 * synchronously on the main thread — parse + stringify are cheap there and a
 * worker round-trip (plus structured-cloning the parsed object back for the
 * tree renderer) would only add latency. Above it, the compute is offloaded to
 * a Web Worker so a large paste does not block interaction (INP). The tree
 * render below always stays on the main thread (chunked via `nextFrame`). Kept
 * here — not in format-runner — so the SSR/prerender graph never imports the
 * worker module, which uses `import.meta.url` and must only run in the browser.
 */
const JSON_WORKER_CHAR_THRESHOLD = 50_000;

interface RenderContext {
  count: number;
  runId: number | null;
}

type JsonFormatterWindow = Window & {
  jsonFormatter?: JSONFormatter;
};

const browserWindow = typeof window !== 'undefined' ? (window as JsonFormatterWindow) : null;

export function JsonFormatterApp() {
  return (
    <div id="json-formatter-tool" className="tool-container jsonf-tool c-tool-stack">
      <div className="o-toolbar jsonf-controls-custom jsonf-toolbar c-action-strip c-toolbar">
        <button className="c-button c-button--ghost jsonf-sample-btn" id="loadSampleBtn" type="button">Load Sample</button>
        <div className="c-checkbox-item jsonf-checkbox-item">
          <input type="checkbox" id="sortKeys" defaultChecked />
          <label htmlFor="sortKeys">Sort keys</label>
        </div>
        <div className="c-checkbox-item jsonf-checkbox-item">
          <input type="checkbox" id="autoFix" defaultChecked />
          <label htmlFor="autoFix">Auto fix</label>
        </div>
        <div className="jsonf-indent-item">
          <label htmlFor="indentSelect">Indent</label>
          <select className="jsonf-indent-select" id="indentSelect" aria-label="Output indentation">
            <option value="2" selected>2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
            <option value="minify">Minified</option>
          </select>
        </div>
        <span className="c-toolbar__spacer" />
        <button className="c-button jsonf-format-btn" id="formatJsonBtn" type="button">
          Format JSON
          <span className="c-kbd" aria-hidden="true">⌘⏎</span>
        </button>
      </div>

      <div className="c-workbench c-workbench--two-col jsonf-workbench">
        <div className="o-panel jsonf-panel jsonf-input-panel c-surface-card c-surface-panel">
          <div className="jsonf-panel-bar">
            <h3>Input JSON</h3>
          </div>
          <div className="o-panel-content jsonf-panel-content">
            <textarea
              className="c-input c-input--textarea jsonf-input-textarea"
              placeholder="Paste your JSON here, or drop a file..."
              aria-label="Input JSON"
            />
          </div>
          <div className="o-panel-content jsonf-panel-content jsonf-status-content">
            <div className="c-input-status jsonf-input-status" id="jsonErrorStatus" />
            <button
              className="c-button c-button--secondary jsonf-goto-error-btn"
              id="goToErrorBtn"
              type="button"
              hidden
            >
              Go to error
            </button>
          </div>
        </div>

        <div className="o-panel jsonf-panel jsonf-output-panel c-surface-card c-surface-panel">
          <div className="jsonf-panel-bar jsonf-output-bar">
            <h3>Formatted Output</h3>
            <div className="jsonf-tabs c-tab-list" role="group" aria-label="Output View">
              <button className="jsonf-tab c-tab-button active" data-view="tree" aria-pressed="true" type="button">Tree View</button>
              <button className="jsonf-tab c-tab-button" data-view="plain" aria-pressed="false" type="button">Plain View</button>
            </div>
          </div>

          <div className="o-panel-content jsonf-panel-content jsonf-output-content">
            <div id="treeView" className="view-container active">
              {/* Floating tree controls, pinned to the top-right of the tree well.
                  They live inside #treeView so they're hidden automatically in
                  Plain View and never shift the tab row. */}
              <div className="jsonf-tree-actions" role="group" aria-label="Tree Controls">
                <button
                  className="c-button c-button--secondary jsonf-tree-btn"
                  id="expandAllBtn"
                  type="button"
                  disabled
                >
                  Expand All
                </button>
                <button
                  className="c-button c-button--secondary jsonf-tree-btn"
                  id="collapseAllBtn"
                  type="button"
                  disabled
                >
                  Collapse All
                </button>
              </div>
              <div id="jsonfEmptyState" className="c-empty-state">
                <span className="c-empty-state__icon" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 13h6M9 17h6" />
                  </svg>
                </span>
                <p className="c-empty-state__message">Formatted JSON will appear here</p>
                <p className="c-empty-state__hint">Paste JSON or load a sample, then run Format JSON.</p>
              </div>
              <pre className="c-code-output jsonf-code-output" tabIndex={0}><code /></pre>
            </div>
            <div id="plainView" className="view-container">
              <textarea
                className="c-input c-input--textarea jsonf-plain-textarea"
                readOnly
                placeholder="Formatted JSON will appear here..."
                aria-label="Formatted JSON Output"
              />
            </div>
          </div>

          <div className="o-panel-content jsonf-panel-content jsonf-output-footer">
            <button className="c-button c-button--secondary jsonf-copy-btn" id="copyOutputBtn" type="button" disabled>Copy Output</button>
            <button
              className="c-button c-button--secondary c-button--icon-download jsonf-download-btn"
              id="downloadOutputBtn"
              type="button"
              disabled
            >
              Download
            </button>
            <button className="c-button c-button--secondary c-button--icon-share jsonf-share-btn" id="shareUrlBtn" type="button">Share</button>
          </div>
        </div>
      </div>

      <div className="c-stats-panel jsonf-stats-panel c-surface-card">
        <div className="c-stat-row">
          <span>Original Size:</span>
          <span className="jsonf-original-size">0 bytes</span>
        </div>
        <div className="c-stat-row">
          <span>Formatted Size:</span>
          <span className="jsonf-formatted-size">0 bytes</span>
        </div>
      </div>

      <div id="notification" className="c-notification" role="status" aria-live="polite" />

    </div>
  );
}

export class JSONFormatter {
  currentRunId: number;
  downloadManager!: DownloadManager;
  input!: HTMLTextAreaElement;
  output!: HTMLElement;
  plainViewTextarea!: HTMLTextAreaElement;
  tabs!: NodeListOf<HTMLButtonElement>;
  viewContainers!: { tree: HTMLElement; plain: HTMLElement };
  formatBtn!: HTMLButtonElement;
  copyBtn!: HTMLButtonElement;
  downloadBtn!: HTMLButtonElement;
  sampleBtn!: HTMLButtonElement;
  shareBtn!: HTMLButtonElement;
  sortCheckbox!: HTMLInputElement;
  autoFixCheckbox!: HTMLInputElement;
  indentSelect!: HTMLSelectElement;
  expandAllBtn!: HTMLButtonElement;
  collapseAllBtn!: HTMLButtonElement;
  errorStatus!: HTMLElement;
  goToErrorBtn!: HTMLButtonElement;
  // 0-based offset of the current syntax error in the input, or null when valid.
  errorIndex: number | null = null;
  originalSizeEl!: HTMLElement;
  formattedSizeEl!: HTMLElement;
  emptyStateEl: HTMLElement | null = null;
  clearButtonInstance!: ClearButton;

  // Lazily-imported worker runner for large inputs. The import (and thus the
  // worker chunk) only loads on the first over-threshold format; falls back to
  // a main-thread `formatJson` if the worker/chunk is unavailable.
  private lazyFormatRunner: LazyRunner<JsonFormatRequest, JsonFormatResult> = createLazyRunner(
    () => import('./format-runner').then((module) => module.createFormatRunner),
    formatJson
  );

  constructor(initDom = true) {
    this.currentRunId = 0;
    if (initDom) {
      this.downloadManager = new DownloadManager();
      this.input = document.querySelector('.c-input.c-input--textarea') as HTMLTextAreaElement;
      this.output = document.querySelector('.c-code-output code') as HTMLElement;
      this.plainViewTextarea = document.querySelector('#plainView .c-input--textarea') as HTMLTextAreaElement;
      this.tabs = document.querySelectorAll<HTMLButtonElement>('.jsonf-tab');
      this.viewContainers = {
        tree: document.querySelector('#treeView') as HTMLElement,
        plain: document.querySelector('#plainView') as HTMLElement
      };
      this.formatBtn = document.querySelector('#formatJsonBtn') as HTMLButtonElement;

      this.copyBtn = document.querySelector('#copyOutputBtn') as HTMLButtonElement;
      this.downloadBtn = document.querySelector('#downloadOutputBtn') as HTMLButtonElement;
      this.sampleBtn = document.querySelector('#loadSampleBtn') as HTMLButtonElement;
      this.shareBtn = document.querySelector('#shareUrlBtn') as HTMLButtonElement;
      this.sortCheckbox = document.querySelector('#sortKeys') as HTMLInputElement;
      this.autoFixCheckbox = document.querySelector('#autoFix') as HTMLInputElement;
      this.indentSelect = document.querySelector('#indentSelect') as HTMLSelectElement;
      this.expandAllBtn = document.querySelector('#expandAllBtn') as HTMLButtonElement;
      this.collapseAllBtn = document.querySelector('#collapseAllBtn') as HTMLButtonElement;
      this.errorStatus = document.querySelector('#jsonErrorStatus') as HTMLElement;
      this.goToErrorBtn = document.querySelector('#goToErrorBtn') as HTMLButtonElement;
      this.originalSizeEl = document.querySelector('.jsonf-original-size') as HTMLElement;
      this.formattedSizeEl = document.querySelector('.jsonf-formatted-size') as HTMLElement;
      // getElementById keeps this off the querySelector-count-sensitive path.
      this.emptyStateEl = document.getElementById('jsonfEmptyState');

      // Initialize ClearButton for the input textarea
      this.clearButtonInstance = new ClearButton(this.input);

      this.initializeEvents();
    }
  }

  // Swap only the button's leading text node so the in-markup `.c-kbd` hint
  // survives the loading-state label flips (a raw textContent write would
  // destroy the span).
  private setPrimaryButtonLabel(text: string): void {
    const first = this.formatBtn.firstChild;
    if (first && first.nodeType === 3 /* Node.TEXT_NODE */) {
      first.textContent = text;
    } else {
      this.formatBtn.textContent = text;
    }
  }

  initializeEvents() {
    if (this.formatBtn) {
      this.formatBtn.addEventListener('click', () => this.formatJSON());
      registerPrimaryActionShortcut(this.formatBtn);
    }

    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => this.copyOutput());
    }

    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.downloadOutput());
    }

    if (this.sampleBtn) {
      this.sampleBtn.addEventListener('click', () => this.loadSampleData());
    }

    if (this.input) {
      registerDropZone(this.input, {
        onText: (text, file) => this.loadDroppedText(text, file.name),
        onError: (message) => NotificationManager.show(message, 3000, { type: 'error' })
      });
    }

    if (this.shareBtn) {
      this.shareBtn.addEventListener('click', () => this.shareUrl());
    }

    if (this.indentSelect) {
      // Re-run formatting when the indentation choice changes so the output,
      // copy/download text, and size stats immediately reflect it.
      this.indentSelect.addEventListener('change', () => {
        if (this.input.value.trim()) {
          this.formatJSON();
        }
      });
    }

    if (this.expandAllBtn) {
      this.expandAllBtn.addEventListener('click', () => this.setAllCollapsed(false));
    }

    if (this.collapseAllBtn) {
      this.collapseAllBtn.addEventListener('click', () => this.setAllCollapsed(true));
    }

    if (this.goToErrorBtn) {
      this.goToErrorBtn.addEventListener('click', () => this.goToError());
    }

    if (this.input) {
      const debouncedUpdate = JSONFormatter.debounce(() => {
        this.updateStats(this.input.value, '');
      }, 150);

      this.input.addEventListener('input', () => {
        this.clearError();
        debouncedUpdate();
      });
    }

    if (this.tabs?.length) {
      this.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const viewName = tab.dataset.view;
          this.switchView(viewName);
        });
      });
    }
  }


  async formatJSON(): Promise<void> {
    // Capture current run ID to prevent stale results
    const runId = ++this.currentRunId;

    try {
      let inputValue = this.input.value.trim();

      // UI Feedback: Show loading state (first-text-node swap keeps `.c-kbd`)
      this.setPrimaryButtonLabel('Formatting...');
      this.formatBtn.disabled = true;
      this.clearError();

      // Yield to main thread
      await scheduleTask(20);

      // Abort if a newer run has started
      if (runId !== this.currentRunId) return;

      // Small inputs format synchronously; large ones are offloaded to the
      // worker (with a main-thread fallback). Either way the result feeds the
      // main-thread tree renderer below.
      const request: JsonFormatRequest = {
        input: inputValue,
        autoFix: this.autoFixCheckbox.checked,
        sortKeys: this.sortCheckbox.checked,
        indent: this.getIndentOption()
      };
      const { formatted, formattedString } = inputValue.length <= JSON_WORKER_CHAR_THRESHOLD
        ? formatJson(request)
        : await this.lazyFormatRunner.run(request);

      // Abort if a newer run started while the worker was computing.
      if (runId !== this.currentRunId) return;

      // Clear previous output
      this.output.replaceChildren();

      const fragment = document.createDocumentFragment();

      // Async render with chunking
      await this.renderJSONAsync(formatted, fragment, 0, { count: 0, runId }, 'root');

      // Abort final UI updates if a newer run has started
      if (runId !== this.currentRunId) return;

      this.output.appendChild(fragment);
      if (this.emptyStateEl) {
        this.emptyStateEl.style.display = 'none';
      }

      this.plainViewTextarea.value = formattedString; // Populate plain view

      this.copyBtn.disabled = false;
      this.downloadBtn.disabled = false;
      this.expandAllBtn.disabled = false;
      this.collapseAllBtn.disabled = false;
      this.updateStats(this.input.value.trim(), formattedString);

      // Minified output is identical in the tree view, so surface the effect by
      // switching to the plain (single-line) view automatically.
      if (request.indent === 'minify') {
        this.switchView('plain');
      }

      NotificationManager.show('JSON formatted successfully!', 2000, { type: 'success' });
    } catch (error: unknown) {
      const fallbackMessage = error instanceof Error ? error.message : String(error);
      this.reportJsonError(this.input.value, this.autoFixCheckbox.checked, fallbackMessage);
      this.copyBtn.disabled = true;
      this.downloadBtn.disabled = true;
      this.expandAllBtn.disabled = true;
      this.collapseAllBtn.disabled = true;
      this.output.replaceChildren();
      this.plainViewTextarea.value = '';
      if (this.emptyStateEl) {
        this.emptyStateEl.style.display = '';
      }
      this.updateStats(this.input.value, '');
    } finally {
      // Restore UI state ONLY if this is still the current run
      if (runId === this.currentRunId) {
        this.setPrimaryButtonLabel('Format JSON');
        this.formatBtn.disabled = false;
      }
    }
  }

  // Refactored to be async and chunked
  async renderJSONAsync(
    data: unknown,
    parentEl: Node & ParentNode,
    depth = 0,
    context: RenderContext = { count: 0, runId: null },
    keyName: string | null = null
  ): Promise<void> {
    // Check if a newer run has started
    if (context.runId !== null && context.runId !== this.currentRunId) return;

    // Check if we need to yield to main thread every ~500 nodes
    if (context.count > 500) {
      await nextFrame();
      // Re-verify after yielding
      if (context.runId !== null && context.runId !== this.currentRunId) return;
      context.count = 0;
    }
    context.count++;

    // Max depth check
    if (depth > 100) {
      const span = document.createElement('span');
      span.textContent = '...';
      span.title = 'Maximum nesting depth reached';
      parentEl.appendChild(span);
      return;
    }

    if (data === null || typeof data !== 'object') {
      const span = document.createElement('span');
      span.textContent = JSON.stringify(data);
      parentEl.appendChild(span);
      return;
    }

    const container = document.createElement('div');
    container.className = 'json-node';
    container.style.marginLeft = `${depth * 15}px`;

    const isArray = Array.isArray(data);
    const arrayData = isArray ? (data as unknown[]) : null;
    const objectData = !isArray ? (data as Record<string, unknown>) : null;
    const isEmpty = isArray ? arrayData!.length === 0 : Object.keys(objectData!).length === 0;

    if (!isEmpty) {
      const toggle = document.createElement('span');
      toggle.className = 'json-toggle';
      toggle.textContent = '-';

      const ariaLabel = keyName ? `Toggle ${keyName}` : 'Toggle item';
      toggle.setAttribute('aria-label', ariaLabel);

      toggle.addEventListener('click', () => {
        container.classList.toggle('collapsed');
        toggle.textContent = container.classList.contains('collapsed') ? '+' : '-';
        toggle.setAttribute('aria-expanded', String(!container.classList.contains('collapsed')));
      });
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle.click();
        }
      });
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');
      container.appendChild(toggle);
    }

    const bracketOpen = document.createElement('span');
    bracketOpen.className = 'json-bracket';
    bracketOpen.textContent = isArray ? '[' : '{';
    container.appendChild(bracketOpen);

    if (!isEmpty) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'json-children';

      if (isArray) {
        for (let i = 0; i < arrayData!.length; i++) {
          const item = arrayData![i];
          const itemContainer = document.createElement('div');
          await this.renderJSONAsync(item, itemContainer, depth + 1, context, `item ${i}`);
          childrenContainer.appendChild(itemContainer);
        }
      } else {
        const entries = Object.entries(objectData!);
        for (const [key, value] of entries) {
          const itemContainer = document.createElement('div');

          const keySpan = document.createElement('span');
          keySpan.className = 'json-key';
          keySpan.textContent = `"${key}": `;
          itemContainer.appendChild(keySpan);

          await this.renderJSONAsync(value, itemContainer, depth + 1, context, key);
          childrenContainer.appendChild(itemContainer);
        }
      }

      container.appendChild(childrenContainer);
    }

    const bracketClose = document.createElement('span');
    bracketClose.className = 'json-bracket';
    bracketClose.textContent = isArray ? ']' : '}';
    container.appendChild(bracketClose);

    parentEl.appendChild(container);
  }



  switchView(viewName: string | undefined): void {
    // Update tabs
    this.tabs.forEach(tab => {
      const isActive = tab.dataset.view === viewName;
      if (isActive) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
      tab.setAttribute('aria-pressed', isActive as unknown as string);
    });

    // Update views
    Object.entries(this.viewContainers).forEach(([name, container]) => {
      if (name === viewName) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });
  }



  // Kept as a static method for the public/test surface; the implementation
  // lives in json-format-core so the worker can share it.
  static sortKeysAlphabetically(obj: unknown): unknown {
    return sortKeysAlphabetically(obj);
  }

  updateStats(original: string, formatted: string): void {
    const originalBytes = new Blob([original]).size;
    const formattedBytes = new Blob([formatted]).size;

    this.originalSizeEl.textContent = formatBytes(originalBytes);
    this.formattedSizeEl.textContent = formatBytes(formattedBytes);
  }

  static debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, delay: number): (...args: TArgs) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: TArgs) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }




  // Kept as a static method for the public/test surface; the implementation
  // lives in json-format-core so the worker can share it.
  static autoFixJSON(jsonString: string): string {
    return autoFixJSON(jsonString);
  }

  prepareFormattedJson(): [unknown, string] {
    const { formatted, formattedString } = formatJson({
      input: this.input.value,
      autoFix: this.autoFixCheckbox.checked,
      sortKeys: this.sortCheckbox.checked,
      indent: this.getIndentOption()
    });

    return [formatted, formattedString];
  }

  /** Read the indentation selector, mapping its string value to an `IndentOption`. */
  getIndentOption(): IndentOption {
    return parseIndentOption(this.indentSelect?.value);
  }

  /**
   * Expand or collapse every node in the tree view at once. Mirrors the per-node
   * toggle handler in `renderJSONAsync`: flips the `.collapsed` class and keeps each
   * toggle's `+`/`-` glyph and `aria-expanded` in sync. Empty objects/arrays have no
   * toggle, so they are skipped.
   */
  setAllCollapsed(collapsed: boolean): void {
    const nodes = this.output.querySelectorAll<HTMLElement>('.json-node');
    nodes.forEach((node) => {
      const toggle = node.querySelector<HTMLElement>(':scope > .json-toggle');
      if (!toggle) return;
      node.classList.toggle('collapsed', collapsed);
      toggle.textContent = collapsed ? '+' : '-';
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  getFormattedOutput(): string {
    try {
      return this.prepareFormattedJson()[1];
    } catch (_error) {
      // If parsing fails, fall back to the original input value
      return this.input.value.trim();
    }
  }

  async copyOutput(): Promise<void> {
    try {
      await copyTextToClipboard(this.getFormattedOutput());
      NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.showError(`Failed to copy. ${message}. Note: Clipboard access requires HTTPS in modern browsers.`);
    }
  }

  showError(message: string): void {
    NotificationManager.show(message, 3000, { type: 'error' });
    this.errorStatus.textContent = message;
    this.errorStatus.classList.add('error');
  }

  /**
   * Surface a formatting failure: show the message, and — when the syntax error can
   * be located (against the same auto-fixed string `formatJson` parsed) — reveal a
   * "Go to error" control and scroll the textarea to the offending line. Falls back
   * to the thrown message and hides the jump when the error carries no usable
   * position, so the engine's wording is never lost and we never offer a bogus jump.
   */
  reportJsonError(rawInput: string, autoFix: boolean, fallbackMessage: string): void {
    const location = locateJsonError(rawInput, autoFix);
    this.showError(`Invalid JSON: ${location ? location.message : fallbackMessage}`);

    if (location && this.goToErrorBtn) {
      this.errorIndex = location.index;
      this.goToErrorBtn.textContent = `Go to error (line ${location.line}, col ${location.column})`;
      this.goToErrorBtn.hidden = false;
      // Bring the error into view without stealing focus while the user reads it.
      this.scrollInputToError(location.index);
    } else {
      this.hideGoToError();
    }
  }

  /** Focus the input and select the offending character so the error is unmistakable. */
  goToError(): void {
    const input = this.input;
    if (this.errorIndex === null || !(input instanceof HTMLTextAreaElement)) return;

    input.focus();
    const end = Math.min(this.errorIndex + 1, input.value.length);
    input.setSelectionRange(this.errorIndex, end);
    this.scrollInputToError(this.errorIndex);
  }

  /** Scroll the input textarea so the line containing `index` is in view. */
  scrollInputToError(index: number): void {
    const input = this.input;
    if (!(input instanceof HTMLTextAreaElement)) return;

    const bound = Math.max(0, Math.min(index, input.value.length));
    const line = (input.value.slice(0, bound).match(/\n/g) || []).length; // 0-based
    const styles = getComputedStyle(input);
    let lineHeight = parseFloat(styles.lineHeight);
    if (!Number.isFinite(lineHeight)) {
      lineHeight = (parseFloat(styles.fontSize) || 14) * 1.5;
    }
    // Center the error line roughly a third from the top of the visible area.
    input.scrollTop = Math.max(0, line * lineHeight - input.clientHeight / 3);
  }

  hideGoToError(): void {
    this.errorIndex = null;
    if (this.goToErrorBtn) {
      this.goToErrorBtn.hidden = true;
    }
  }

  clearError(): void {
    this.errorStatus.textContent = '';
    this.errorStatus.classList.remove('error');
    this.hideGoToError();
  }


  async downloadOutput(): Promise<void> {
    try {
      const textToDownload = this.getFormattedOutput();
      this.downloadManager.downloadFile(textToDownload, 'formatted.json', 'application/json');
      NotificationManager.show('Download started!', 2000, { type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      NotificationManager.show(`Download failed: ${message}`, 3000, { type: 'error' });
    }
  }

  loadSampleData(): void {
    const sampleData = {
      "userProfile": {
        "id": 12345,
        "username": "johndoe",
        "email": "john.doe@example.com",
        "isActive": true,
        "joinDate": "2024-03-16T20:37:00Z",
        "preferences": {
          "theme": "dark",
          "notifications": {
            "email": true,
            "push": false,
            "frequency": "daily"
          },
          "language": "en-US"
        }
      },
      "posts": [
        {
          "id": "p123",
          "title": "My First Post",
          "content": "Hello World!",
          "tags": ["welcome", "introduction"],
          "likes": 42,
          "timestamp": "2024-03-16T15:30:00Z",
          "comments": null
        },
        {
          "id": "p124",
          "title": "JSON Formatting Guide",
          "content": "Learn how to format JSON properly...",
          "tags": ["tutorial", "json", "coding"],
          "likes": 128,
          "timestamp": "2024-03-16T18:45:00Z",
          "comments": [
            {
              "user": "alice",
              "text": "Great tutorial!",
              "timestamp": "2024-03-16T19:00:00Z"
            }
          ]
        }
      ],
      "stats": {
        "totalPosts": 2,
        "totalLikes": 170,
        "averagePostLength": 256.5,
        "topTags": ["json", "tutorial", "welcome"]
      }
    };

    this.input.value = JSON.stringify(sampleData);
    this.clearButtonInstance.updateVisibility(); // Explicitly update ClearButton visibility
    this.formatJSON();
    NotificationManager.show('Sample data loaded successfully!', 2000, { type: 'success' });
  }

  /**
   * Load a dropped file's contents as if they had been pasted. Reuses the
   * Load Sample path so the tree, stats, and Clear button all refresh.
   */
  loadDroppedText(text: string, fileName: string): void {
    this.input.value = text;
    this.clearButtonInstance.updateVisibility();
    // Toast before formatting, not after: `formatJSON` raises its own
    // success toast, and they share one notification element — announcing the
    // load first leaves the sequence in the order the user experiences it.
    NotificationManager.show(`Loaded ${fileName}`, 2000, { type: 'success' });
    this.formatJSON();
  }

  /**
   * Build a shareable URL (current JSON + settings, LZ-compressed into the hash
   * fragment — never sent to a server) and copy it to the clipboard. Guarded
   * against empty input and against payloads too large to share as a URL.
   */
  async shareUrl(): Promise<void> {
    const trimmedInput = this.input.value.trim();
    if (!trimmedInput) {
      NotificationManager.show('Enter some JSON before sharing.', 3000, { type: 'error' });
      return;
    }

    const payload: ShareUrlPayload = {
      input: this.input.value,
      indent: this.getIndentOption(),
      sortKeys: this.sortCheckbox.checked,
      autoFix: this.autoFixCheckbox.checked
    };
    const url = buildShareUrl(window.location.href, payload);

    if (url.length > SHARE_URL_MAX_LENGTH) {
      NotificationManager.show(
        `JSON is too large to share as a URL (limit ~${SHARE_URL_MAX_LENGTH} characters). Try Download instead.`,
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
  }

  /**
   * Preload the input + settings from a shared link (hash fragment, or the
   * legacy query-string fallback), if present, and format immediately.
   * Silently no-ops when neither carries a payload. Awaits formatJSON so the
   * "loaded" notification is not immediately overwritten by formatJSON's own
   * success/error toast (they share a single notification element).
   */
  async loadFromShareLocation(locationLike: Pick<Location, 'hash' | 'search'>): Promise<void> {
    const { payload, source } = resolveSharePayload(locationLike);
    if (!payload) return;

    this.input.value = payload.input;
    this.sortCheckbox.checked = payload.sortKeys;
    this.autoFixCheckbox.checked = payload.autoFix;
    this.indentSelect.value = String(payload.indent);
    this.clearButtonInstance.updateVisibility();
    await this.formatJSON();
    NotificationManager.show('Loaded JSON from shared link.', 2000, { type: 'success' });

    if (source === 'query') {
      NotificationManager.show(
        'Legacy ?j= preload detected. Prefer #j= to avoid leaking content in URLs.',
        4000,
        { type: 'warning' }
      );
    }
  }
}

export class JSONFormatterToolUI {
  formatter: JSONFormatter;

  constructor(rootSelector = '#json-formatter-app') {
    const root = document.querySelector<HTMLElement>(rootSelector) || document.querySelector<HTMLElement>('#json-formatter-tool');
    if (!root) {
      throw new Error('JSON Formatter root element not found');
    }

    const mount = root.hasChildNodes() ? hydrate : render;
    mount(<JsonFormatterApp />, root);
    this.formatter = new JSONFormatter(true);
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    mountToolShell({
      title: toolMetadata.title,
      description: toolMetadata.description,
      homeHref: '/'
    });

    const tool = new JSONFormatterToolUI();
    if (browserWindow) {
      browserWindow.jsonFormatter = tool.formatter;
    }
    tool.formatter.loadFromShareLocation(window.location);
  });
}
