export class JSONFormatter {
  constructor(initDom = true) {
    if (initDom) {
      this.input = document.querySelector('.jsonf-input');
      this.output = document.querySelector('.jsonf-output code');
      this.copyBtn = document.querySelector('.jsonf-button.jsonf-secondary');
      this.formatBtn = document.querySelector('.jsonf-button:not(.jsonf-secondary):not(.jsonf-sample)');
      this.sampleBtn = document.querySelector('.jsonf-button.jsonf-sample');
      this.errorContainer = document.querySelector('.jsonf-error');
      this.originalSizeEl = document.querySelector('.jsonf-original-size');
      this.formattedSizeEl = document.querySelector('.jsonf-formatted-size');

      this.initializeEvents();
    }
  }

  initializeEvents() {
    if (this.formatBtn && this.copyBtn && this.sampleBtn && this.input) {
      this.formatBtn.addEventListener('click', () => this.formatJSON());
      this.copyBtn.addEventListener('click', () => this.copyOutput());
      this.sampleBtn.addEventListener('click', () => this.loadSampleData());
      this.input.addEventListener('input', () => {
        this.clearError();
        this.updateStats(this.input.value, '');
      });
    }
  }

  formatJSON() {
    try {
      const inputValue = this.input.value.trim();
      const parsed = JSON.parse(inputValue);
      const sorted = this.sortKeysAlphabetically(parsed);
      const formatted = JSON.stringify(sorted, null, 2);
      
      this.output.innerHTML = Prism.highlight(formatted, Prism.languages.json, 'json');
      this.copyBtn.disabled = false;
      this.errorContainer.textContent = '';
      this.updateStats(inputValue, formatted);
    } catch (error) {
      this.showError(`Invalid JSON: ${error.message}`);
      this.copyBtn.disabled = true;
      this.updateStats(this.input.value, '');
    }
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
    const units = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  copyOutput() {
    const textToCopy = this.output.textContent;
    navigator.clipboard.writeText(textToCopy)
      .then(() => this.showTemporaryMessage('Copied to clipboard!'))
      .catch(() => this.showError('Failed to copy to clipboard'));
  }

  showError(message) {
    this.errorContainer.textContent = message;
    this.errorContainer.classList.add('active');
  }

  clearError() {
    this.errorContainer.textContent = '';
    this.errorContainer.classList.remove('active');
  }

  showTemporaryMessage(message) {
    const msg = document.createElement('div');
    msg.textContent = message;
    msg.className = 'jsonf-temp-message';
    document.body.appendChild(msg);
    
    setTimeout(() => msg.remove(), 2000);
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
  }
}

// Initialize tool when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new JSONFormatter());
