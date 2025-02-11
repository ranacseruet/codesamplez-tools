class JSONPrettyPrinter {
  constructor() {
    this.input = document.querySelector('.jsonpp-input');
    this.output = document.querySelector('.jsonpp-output');
    this.copyBtn = document.querySelector('.jsonpp-copy-btn');
    this.formatBtn = document.querySelector('.jsonpp-format-btn');
    this.errorContainer = document.querySelector('.jsonpp-error');

    this.initializeEvents();
  }

  initializeEvents() {
    this.formatBtn.addEventListener('click', () => this.formatJSON());
    this.copyBtn.addEventListener('click', () => this.copyOutput());
    this.input.addEventListener('input', () => this.clearError());
  }

  formatJSON() {
    try {
      const parsed = JSON.parse(this.input.value);
      const sorted = this.sortKeysAlphabetically(parsed);
      const formatted = JSON.stringify(sorted, null, 2);
      
      this.output.innerHTML = Prism.highlight(formatted, Prism.languages.javascript, 'javascript');
      this.copyBtn.disabled = false;
      this.errorContainer.textContent = '';
    } catch (error) {
      this.showError(`Invalid JSON: ${error.message}`);
      this.copyBtn.disabled = true;
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

  copyOutput() {
    navigator.clipboard.writeText(this.output.textContent)
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
    msg.className = 'jsonpp-temp-message';
    document.body.appendChild(msg);
    
    setTimeout(() => msg.remove(), 2000);
  }
}

// Initialize tool when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new JSONPrettyPrinter());
