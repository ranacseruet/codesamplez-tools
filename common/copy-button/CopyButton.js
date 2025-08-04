class CopyButton {
    constructor(targetElement) {
        if (!(targetElement instanceof HTMLTextAreaElement) && !(targetElement instanceof HTMLInputElement)) {
            throw new Error('CopyButton must be initialized with a valid HTMLTextAreaElement or HTMLInputElement.');
        }

        this.targetElement = targetElement;
        this.copyButton = this.createCopyButton();
        this.appendCopyButton();
        this.addEventListeners();
        this.updateVisibility();
    }

    createCopyButton() {
        const button = document.createElement('button');
        button.classList.add('copy-button');
        button.setAttribute('aria-label', 'Copy content to clipboard');
        button.setAttribute('title', 'Copy to clipboard');
        return button;
    }

    appendCopyButton() {
        // Check if element is already wrapped by ClearButton
        const existingWrapper = this.targetElement.parentNode;
        
        if (existingWrapper && existingWrapper.classList.contains('clear-button-wrapper')) {
            // Use existing wrapper and position copy button differently
            this.wrapper = existingWrapper;
            this.wrapper.classList.add('copy-button-wrapper');
        } else {
            // Create new wrapper
            this.wrapper = document.createElement('div');
            this.wrapper.classList.add('copy-button-wrapper');
            this.targetElement.parentNode.insertBefore(this.wrapper, this.targetElement);
            this.wrapper.appendChild(this.targetElement);
        }
        
        this.wrapper.appendChild(this.copyButton);
    }

    addEventListeners() {
        // Store bound functions as instance properties for proper cleanup
        this.boundCopyContent = this.copyContent.bind(this);
        this.boundUpdateVisibility = this.updateVisibility.bind(this);
        
        this.copyButton.addEventListener('click', this.boundCopyContent);
        
        // Listen for all events that can change the textarea value
        this.targetElement.addEventListener('input', this.boundUpdateVisibility);
        this.targetElement.addEventListener('paste', this.boundUpdateVisibility);
        this.targetElement.addEventListener('cut', this.boundUpdateVisibility);
        this.targetElement.addEventListener('keyup', this.boundUpdateVisibility);
        this.targetElement.addEventListener('change', this.boundUpdateVisibility);
    }

    disconnect() {
        // Remove event listeners to prevent memory leaks
        if (this.boundUpdateVisibility) {
            this.targetElement.removeEventListener('input', this.boundUpdateVisibility);
            this.targetElement.removeEventListener('paste', this.boundUpdateVisibility);
            this.targetElement.removeEventListener('cut', this.boundUpdateVisibility);
            this.targetElement.removeEventListener('keyup', this.boundUpdateVisibility);
            this.targetElement.removeEventListener('change', this.boundUpdateVisibility);
        }
        
        if (this.boundCopyContent) {
            this.copyButton.removeEventListener('click', this.boundCopyContent);
        }
    }

    async copyContent() {
        const content = this.targetElement.value;
        
        if (!content.trim()) {
            return;
        }

        try {
            // Try modern Clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(content);
            } else {
                // Fallback for older browsers or non-secure contexts
                this.fallbackCopyToClipboard(content);
            }
            
            this.showSuccessAnimation();
            this.dispatchCopyEvent(content);
            
        } catch (error) {
            console.warn('Copy to clipboard failed:', error);
            // Try fallback method
            try {
                this.fallbackCopyToClipboard(content);
                this.showSuccessAnimation();
                this.dispatchCopyEvent(content);
            } catch (fallbackError) {
                console.error('All copy methods failed:', fallbackError);
                this.showErrorAnimation();
            }
        }
    }

    fallbackCopyToClipboard(text) {
        // Create a temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (!successful) {
                throw new Error('execCommand copy failed');
            }
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showSuccessAnimation() {
        this.copyButton.classList.add('copy-success');
        
        // Remove the class after animation completes
        setTimeout(() => {
            this.copyButton.classList.remove('copy-success');
        }, 600);
    }

    showErrorAnimation() {
        this.copyButton.classList.add('copy-error');
        
        // Remove the class after animation completes
        setTimeout(() => {
            this.copyButton.classList.remove('copy-error');
        }, 600);
    }

    dispatchCopyEvent(content) {
        const copyEvent = new CustomEvent('contentCopied', { 
            bubbles: true,
            detail: {
                content: content,
                length: content.length,
                timestamp: new Date().toISOString()
            }
        });
        this.targetElement.dispatchEvent(copyEvent);
    }

    updateVisibility() {
        if (this.targetElement.value.length > 0) {
            this.copyButton.style.display = 'block';
        } else {
            this.copyButton.style.display = 'none';
        }
        return this; // Allow method chaining
    }
    
    // Public method to force visibility update
    forceUpdateVisibility() {
        this.updateVisibility();
        return this; // Allow method chaining
    }
}

export default CopyButton;
