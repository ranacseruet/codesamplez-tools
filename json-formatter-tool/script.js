import { NotificationManager } from '../common/notification-manager.js';

export class JSONFormatter {
  constructor(initDom = true) {
    if (initDom) {
      this.input = document.querySelector('.c-input.c-input--textarea');
      this.output = document.querySelector('.c-code-output code');
      this.formatBtn = document.querySelector('#formatJsonBtn');
      this.copyBtn = document.querySelector('#copyOutputBtn');
      this.downloadBtn = document.querySelector('#downloadOutputBtn');
      this.sampleBtn = document.querySelector('#loadSampleBtn');
      this.sortCheckbox = document.querySelector('#sortKeys'); // Use ID for checkbox
      this.clearInputBtn = document.querySelector('#clearInputBtn');
      this.errorStatus = document.querySelector('#jsonErrorStatus');
      this.originalSizeEl = document.querySelector('.jsonf-original-size'); // This class was kept
      this.formattedSizeEl = document.querySelector('.jsonf-formatted-size'); // This class was kept

      this.initializeEvents();
    }
  }

  initializeEvents() {
    if (this.formatBtn && this.copyBtn && this.downloadBtn && this.sampleBtn && this.input) {
      this.formatBtn.addEventListener('click', () => this.formatJSON());
      this.copyBtn.addEventListener('click', () => this.copyOutput());
      this.downloadBtn.addEventListener('click', () => this.downloadOutput());
      this.sampleBtn.addEventListener('click', () => this.loadSampleData());
      this.input.addEventListener('input', () => {
        this.clearError();
        this.updateStats(this.input.value, '');
      });
      if (this.clearInputBtn) {
        this.clearInputBtn.addEventListener('click', () => this.clearInput());
      }
    }
  }

  formatJSON() {
    try {
      const inputValue = this.input.value.trim();
      const parsed = JSON.parse(inputValue);
      const formatted = this.sortCheckbox.checked 
        ? this.sortKeysAlphabetically(parsed)
        : parsed;
      
      this.output.innerHTML = '';
      this.renderJSON(formatted, this.output);
      this.copyBtn.disabled = false;
      this.downloadBtn.disabled = false;
      // No need to manipulate errorContainer as NotificationManager handles messaging
      this.updateStats(inputValue, JSON.stringify(formatted, null, 2));
      NotificationManager.show('JSON formatted successfully!', 2000, { type: 'success' });
    } catch (error) {
      this.showError(`Invalid JSON: ${error.message}`);
      this.copyBtn.disabled = true;
      this.updateStats(this.input.value, '');
    }
  }

  renderJSON(data, parentEl, depth = 0) {
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
    const isEmpty = isArray ? data.length === 0 : Object.keys(data).length === 0;

    if (!isEmpty) {
      const toggle = document.createElement('span');
      toggle.className = 'json-toggle';
      toggle.textContent = '-'; // Initial state is expanded
      toggle.addEventListener('click', () => {
        container.classList.toggle('collapsed');
        toggle.textContent = container.classList.contains('collapsed') ? '+' : '-'; // '+' for collapsed, '-' for expanded
      });
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
        data.forEach((item, i) => {
          const itemContainer = document.createElement('div');
          this.renderJSON(item, itemContainer, depth + 1);
          childrenContainer.appendChild(itemContainer);
        });
      } else {
        Object.entries(data).forEach(([key, value]) => {
          const itemContainer = document.createElement('div');
          
          const keySpan = document.createElement('span');
          keySpan.className = 'json-key';
          keySpan.textContent = `"${key}": `;
          itemContainer.appendChild(keySpan);
          
          this.renderJSON(value, itemContainer, depth + 1);
          childrenContainer.appendChild(itemContainer);
        });
      }
      
      container.appendChild(childrenContainer);
    }

    const bracketClose = document.createElement('span');
    bracketClose.className = 'json-bracket';
    bracketClose.textContent = isArray ? ']' : '}';
    container.appendChild(bracketClose);

    parentEl.appendChild(container);
  }

  sortKeysAlphabetically(obj) {
    if (Array.isArray(obj)) return obj.map(item => this.sortKeysAlphabetically(item));
    if (typeof obj !== 'object' || obj === null) return obj;

    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = this.sortKeysAlphabetically(obj[key]);
        return sorted;
      }, {});
  }

  updateStats(original, formatted) {
    const originalBytes = new Blob([original]).size;
    const formattedBytes = new Blob([formatted]).size;
    
    this.originalSizeEl.textContent = this.formatBytes(originalBytes);
    this.formattedSizeEl.textContent = this.formatBytes(formattedBytes);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 bytes';
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  getFormattedOutput() {
    const inputValue = this.input.value.trim();
    try {
      const parsed = JSON.parse(inputValue);
      const formatted = this.sortCheckbox.checked 
        ? this.sortKeysAlphabetically(parsed)
        : parsed;
      return JSON.stringify(formatted, null, 2);
    } catch (error) {
      // If parsing fails, fall back to the input value
      return inputValue;
    }
  }

  async copyOutput() {
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
    } catch (err) {
      this.showError(`Failed to copy. ${err.message}. Note: Clipboard access requires HTTPS in modern browsers.`);
    }
  }

  showError(message) {
    NotificationManager.show(message, 3000, { type: 'error' });
    this.errorStatus.textContent = message;
    this.errorStatus.classList.add('error');
  }

  clearError() {
    this.errorStatus.textContent = '';
    this.errorStatus.classList.remove('error');
  }

  clearInput() {
    this.input.value = '';
    this.clearError();
    this.updateStats('', '');
    NotificationManager.show('Input cleared!', 2000, { type: 'success' });
  }

  async downloadOutput() {
    try {
      const textToDownload = this.getFormattedOutput();
      const blob = new Blob([textToDownload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'formatted.json';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      NotificationManager.show('Download started!', 2000, { type: 'success' });
    } catch (err) {
      NotificationManager.show(`Download failed: ${err.message}`, 3000, { type: 'error' });
    }
  }

  loadSampleData() {
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
    this.formatJSON();
    NotificationManager.show('Sample data loaded successfully!', 2000, { type: 'success' });
  }
}

// Initialize tool when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new JSONFormatter());
