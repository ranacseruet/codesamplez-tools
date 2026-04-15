import { NotificationManager } from '../common/notification-manager';
import { formatBytes } from '../common/format-utils';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import { scheduleTask, nextFrame } from '../common/scheduler-utils';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { JsonFormatterArticle, JsonFormatterIntro } from './content';
import toolMetadata from './tool.meta.json';

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
      <JsonFormatterIntro />

      <div className="o-panel jsonf-panel jsonf-input-panel c-surface-card c-surface-panel">
        <h3>Input JSON</h3>
        <div className="o-panel-content jsonf-panel-content">
          <textarea
            className="c-input c-input--textarea jsonf-input-textarea"
            placeholder="Paste your JSON here..."
            aria-label="Input JSON"
          />
        </div>
        <div className="o-panel-content jsonf-panel-content jsonf-status-content">
          <div className="c-input-status jsonf-input-status" id="jsonErrorStatus" />
        </div>
      </div>

      <div className="o-toolbar jsonf-controls-custom jsonf-toolbar c-action-strip">
        <button className="c-button jsonf-format-btn" id="formatJsonBtn" type="button">Format JSON</button>
        <button className="c-button c-button--secondary jsonf-sample-btn" id="loadSampleBtn" type="button">Load Sample</button>
        <div className="c-checkbox-item jsonf-checkbox-item">
          <input type="checkbox" id="sortKeys" defaultChecked />
          <label htmlFor="sortKeys">Sort keys</label>
        </div>
        <div className="c-checkbox-item jsonf-checkbox-item">
          <input type="checkbox" id="autoFix" defaultChecked />
          <label htmlFor="autoFix">Auto fix</label>
        </div>
      </div>

      <div className="o-panel jsonf-panel jsonf-output-panel c-surface-card c-surface-panel">
        <h3>Formatted Output</h3>
        <div className="o-panel-header jsonf-panel-header">
          <button className="c-button c-button--secondary jsonf-copy-btn" id="copyOutputBtn" type="button" disabled>Copy Output</button>
          <button
            className="c-button c-button--secondary c-button--icon-download jsonf-download-btn"
            id="downloadOutputBtn"
            type="button"
            disabled
          >
            Download
          </button>
        </div>

        <div className="jsonf-tabs c-tab-list" role="group" aria-label="Output View">
          <button className="jsonf-tab c-tab-button active" data-view="tree" aria-pressed="true" type="button">Tree View</button>
          <button className="jsonf-tab c-tab-button" data-view="plain" aria-pressed="false" type="button">Plain View</button>
        </div>

        <div className="o-panel-content jsonf-panel-content jsonf-output-content">
          <div id="treeView" className="view-container active">
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
      <div className="jsonf-footer c-tool-footer">Made by Developer, for developers with ❤️</div>

      <JsonFormatterArticle />
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
  sortCheckbox!: HTMLInputElement;
  autoFixCheckbox!: HTMLInputElement;
  errorStatus!: HTMLElement;
  originalSizeEl!: HTMLElement;
  formattedSizeEl!: HTMLElement;
  clearButtonInstance!: ClearButton;

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
      this.sortCheckbox = document.querySelector('#sortKeys') as HTMLInputElement;
      this.autoFixCheckbox = document.querySelector('#autoFix') as HTMLInputElement;
      this.errorStatus = document.querySelector('#jsonErrorStatus') as HTMLElement;
      this.originalSizeEl = document.querySelector('.jsonf-original-size') as HTMLElement;
      this.formattedSizeEl = document.querySelector('.jsonf-formatted-size') as HTMLElement;

      // Initialize ClearButton for the input textarea
      this.clearButtonInstance = new ClearButton(this.input);

      this.initializeEvents();
    }
  }

  initializeEvents() {
    if (this.formatBtn) {
      this.formatBtn.addEventListener('click', () => this.formatJSON());
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

      // UI Feedback: Show loading state
      const originalBtnText = this.formatBtn.textContent;
      this.formatBtn.textContent = 'Formatting...';
      this.formatBtn.disabled = true;
      this.clearError();

      // Yield to main thread
      await scheduleTask(20);

      // Abort if a newer run has started
      if (runId !== this.currentRunId) return;

      const [formatted, formattedString] = this.prepareFormattedJson();

      // Clear previous output
      this.output.replaceChildren();

      const fragment = document.createDocumentFragment();

      // Async render with chunking
      await this.renderJSONAsync(formatted, fragment, 0, { count: 0, runId }, 'root');

      // Abort final UI updates if a newer run has started
      if (runId !== this.currentRunId) return;

      this.output.appendChild(fragment);

      this.plainViewTextarea.value = formattedString; // Populate plain view

      this.copyBtn.disabled = false;
      this.downloadBtn.disabled = false;
      this.updateStats(this.input.value.trim(), formattedString);
      NotificationManager.show('JSON formatted successfully!', 2000, { type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.showError(`Invalid JSON: ${message}`);
      this.copyBtn.disabled = true;
      this.downloadBtn.disabled = true;
      this.output.replaceChildren();
      this.plainViewTextarea.value = '';
      this.updateStats(this.input.value, '');
    } finally {
      // Restore UI state ONLY if this is still the current run
      if (runId === this.currentRunId) {
        this.formatBtn.textContent = 'Format JSON';
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



  static sortKeysAlphabetically(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(item => this.sortKeysAlphabetically(item));
    if (typeof obj !== 'object' || obj === null) return obj;

    const record = obj as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = this.sortKeysAlphabetically(record[key]);
        return sorted;
      }, {} as Record<string, unknown>);
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




  static autoFixJSON(jsonString: string): string {
    // Remove trailing commas
    let fixedJson = jsonString.replace(/,\s*([}\]])/g, '$1');

    // Convert single-quoted strings to double-quoted (handles escaped quotes)
    fixedJson = fixedJson.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    // Add quotes to unquoted keys
    fixedJson = fixedJson.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

    return fixedJson;
  }

  prepareFormattedJson(): [unknown, string] {
    let inputValue = this.input.value.trim();
    if (this.autoFixCheckbox.checked) {
      inputValue = JSONFormatter.autoFixJSON(inputValue);
    }

    const parsed = JSON.parse(inputValue) as unknown;
    const formatted = this.sortCheckbox.checked
      ? JSONFormatter.sortKeysAlphabetically(parsed)
      : parsed;

    return [formatted, JSON.stringify(formatted, null, 2)];
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
      const textToCopy = this.getFormattedOutput();

      // Try modern Clipboard API first
      if (globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(textToCopy);
        NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
        return;
      }

      // Fallback to execCommand for older browsers/HTTP contexts
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';  // Prevent scrolling to bottom
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        if (!successful) {
          throw new Error('Copy command failed');
        }
        NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
      } finally {
        document.body.removeChild(textarea);
      }
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

  clearError(): void {
    this.errorStatus.textContent = '';
    this.errorStatus.classList.remove('error');
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
  });
}
