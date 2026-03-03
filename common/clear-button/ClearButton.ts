class ClearButton {
    textArea: HTMLTextAreaElement;
    clearButton: HTMLButtonElement;
    wrapper: HTMLDivElement;
    boundClearText: (() => void) | null;
    boundUpdateVisibility: (() => void) | null;

    constructor(textAreaElement: HTMLTextAreaElement) {
        if (!(textAreaElement instanceof HTMLTextAreaElement)) {
            throw new Error('ClearButton must be initialized with a valid HTMLTextAreaElement.');
        }

        this.textArea = textAreaElement;
        this.clearButton = this.createClearButton();
        this.wrapper = document.createElement('div');
        this.boundClearText = null;
        this.boundUpdateVisibility = null;
        this.appendClearButton();
        this.addEventListeners();
        this.updateVisibility();
    }

    createClearButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.classList.add('clear-button');
        button.setAttribute('aria-label', 'Clear text');
        return button;
    }

    appendClearButton(): void {
        // Create wrapper for the clear button
        this.wrapper.classList.add('clear-button-wrapper');
        this.textArea.parentNode!.insertBefore(this.wrapper, this.textArea);
        this.wrapper.appendChild(this.textArea);
        this.wrapper.appendChild(this.clearButton);
    }

    addEventListeners(): void {
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

    disconnect(): void {
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

    clearText(): void {
        // Add clearing animation
        this.clearButton.classList.add('clearing');
        
        // Clear the text
        this.textArea.value = '';
        this.updateVisibility();
        this.textArea.focus();
        
        // Dispatch events
        const inputEvent = new Event('input', { bubbles: true });
        this.textArea.dispatchEvent(inputEvent);

        const clearEvent = new CustomEvent('textCleared', { bubbles: true });
        this.textArea.dispatchEvent(clearEvent);
        
        // Show success feedback
        setTimeout(() => {
            this.clearButton.classList.remove('clearing');
            this.clearButton.classList.add('clear-success');
            
            // Remove success state after animation
            setTimeout(() => {
                this.clearButton.classList.remove('clear-success');
            }, 800);
        }, 300);
    }

    updateVisibility(): void {
        if (this.textArea.value.length > 0) {
            this.clearButton.style.display = 'block';
        } else {
            this.clearButton.style.display = 'none';
        }
    }
}

export default ClearButton;
