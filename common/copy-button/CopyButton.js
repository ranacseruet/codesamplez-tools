class CopyButton {
    constructor(targetElement) {
        if (!(targetElement instanceof HTMLTextAreaElement) && 
            !(targetElement instanceof HTMLInputElement) && 
            !(targetElement instanceof HTMLPreElement)) {
            throw new Error('CopyButton must be initialized with a valid HTMLTextAreaElement, HTMLInputElement, or HTMLPreElement.');
        }

        this.targetElement = targetElement;
        this.isPreElement = targetElement instanceof HTMLPreElement;
        this.copyButton = this.createCopyButton();
        this.appendCopyButton();
        this.addEventListeners();
        this.updateVisibility();
    }

    createCopyButton() {
        const button = document.createElement('button');
        button.type = 'button'; // Prevent form submission when inside forms
        button.classList.add('copy-button');
        button.setAttribute('aria-label', 'Copy content to clipboard');
        button.setAttribute('title', 'Copy to clipboard');
        return button;
    }

    appendCopyButton() {
        // Create wrapper for the copy button
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('copy-button-wrapper');
        this.targetElement.parentNode.insertBefore(this.wrapper, this.targetElement);
        this.wrapper.appendChild(this.targetElement);
        this.wrapper.appendChild(this.copyButton);
    }

    addEventListeners() {
        // Store bound functions as instance properties for proper cleanup
        this.boundCopyContent = this.copyContent.bind(this);
        this.boundUpdateVisibility = this.updateVisibility.bind(this);
        
        this.copyButton.addEventListener('click', this.boundCopyContent);
        
        if (this.isPreElement) {
            // For pre elements, use MutationObserver to detect content changes
            this.mutationObserver = new MutationObserver(this.boundUpdateVisibility);
            this.mutationObserver.observe(this.targetElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        } else {
            // For textarea/input elements, use traditional form events
            this.targetElement.addEventListener('input', this.boundUpdateVisibility);
            this.targetElement.addEventListener('paste', this.boundUpdateVisibility);
            this.targetElement.addEventListener('cut', this.boundUpdateVisibility);
            this.targetElement.addEventListener('keyup', this.boundUpdateVisibility);
            this.targetElement.addEventListener('change', this.boundUpdateVisibility);
        }
    }

    disconnect() {
        // Remove event listeners to prevent memory leaks
        if (this.isPreElement) {
            // Disconnect MutationObserver for pre elements
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }
        } else {
            // Remove form event listeners for textarea/input elements
            if (this.boundUpdateVisibility) {
                this.targetElement.removeEventListener('input', this.boundUpdateVisibility);
                this.targetElement.removeEventListener('paste', this.boundUpdateVisibility);
                this.targetElement.removeEventListener('cut', this.boundUpdateVisibility);
                this.targetElement.removeEventListener('keyup', this.boundUpdateVisibility);
                this.targetElement.removeEventListener('change', this.boundUpdateVisibility);
            }
        }
        
        if (this.boundCopyContent) {
            this.copyButton.removeEventListener('click', this.boundCopyContent);
        }
    }

    getContent() {
        return this.isPreElement ? this.targetElement.textContent : this.targetElement.value;
    }

    async copyContent() {
        const content = this.getContent();
        
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
        const content = this.getContent();
        if (content.length > 0) {
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
