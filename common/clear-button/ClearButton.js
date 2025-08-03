class ClearButton {
    constructor(textAreaElement) {
        if (!(textAreaElement instanceof HTMLTextAreaElement)) {
            throw new Error('ClearButton must be initialized with a valid HTMLTextAreaElement.');
        }

        this.textArea = textAreaElement;
        this.clearButton = this.createClearButton();
        this.appendClearButton();
        this.addEventListeners();
        this.updateVisibility();
    }

    createClearButton() {
        const button = document.createElement('button');
        button.classList.add('clear-button');
        button.setAttribute('aria-label', 'Clear text');
        return button;
    }

    appendClearButton() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('clear-button-wrapper');
        this.textArea.parentNode.insertBefore(wrapper, this.textArea);
        wrapper.appendChild(this.textArea);
        wrapper.appendChild(this.clearButton);
    }

    addEventListeners() {
        // Store bound functions as instance properties for proper cleanup
        this.boundClearText = this.clearText.bind(this);
        this.boundUpdateVisibility = this.updateVisibility.bind(this);
        
        this.clearButton.addEventListener('click', this.boundClearText);
        
        // Listen for all events that can change the textarea value
        this.textArea.addEventListener('input', this.boundUpdateVisibility);
        this.textArea.addEventListener('paste', this.boundUpdateVisibility);
        this.textArea.addEventListener('cut', this.boundUpdateVisibility);
        this.textArea.addEventListener('keyup', this.boundUpdateVisibility);
        this.textArea.addEventListener('change', this.boundUpdateVisibility);
    }

    disconnect() {
        // Remove event listeners to prevent memory leaks
        if (this.boundUpdateVisibility) {
            this.textArea.removeEventListener('input', this.boundUpdateVisibility);
            this.textArea.removeEventListener('paste', this.boundUpdateVisibility);
            this.textArea.removeEventListener('cut', this.boundUpdateVisibility);
            this.textArea.removeEventListener('keyup', this.boundUpdateVisibility);
            this.textArea.removeEventListener('change', this.boundUpdateVisibility);
        }
        
        if (this.boundClearText) {
            this.clearButton.removeEventListener('click', this.boundClearText);
        }
    }

    clearText() {
        this.textArea.value = '';
        this.updateVisibility();
        this.textArea.focus();
        const inputEvent = new Event('input', { bubbles: true });
        this.textArea.dispatchEvent(inputEvent);

        const clearEvent = new CustomEvent('textCleared', { bubbles: true });
        this.textArea.dispatchEvent(clearEvent);
    }

    updateVisibility() {
        if (this.textArea.value.length > 0) {
            this.clearButton.style.display = 'block';
        } else {
            this.clearButton.style.display = 'none';
        }
    }
}

export default ClearButton;
