import { copyTextToClipboard } from '../clipboard';

type CopyTargetElement = HTMLTextAreaElement | HTMLInputElement | HTMLPreElement;

class CopyButton {
    targetElement: CopyTargetElement;
    isPreElement: boolean;
    copyButton: HTMLButtonElement;
    wrapper: HTMLDivElement;
    boundCopyContent: (() => void) | null;
    boundUpdateVisibility: (() => void) | null;
    mutationObserver?: MutationObserver | null;

    constructor(targetElement: CopyTargetElement) {
        if (!(targetElement instanceof HTMLTextAreaElement) &&
            !(targetElement instanceof HTMLInputElement) &&
            !(targetElement instanceof HTMLPreElement)) {
            throw new Error('CopyButton must be initialized with a valid HTMLTextAreaElement, HTMLInputElement, or HTMLPreElement.');
        }

        this.targetElement = targetElement;
        this.isPreElement = targetElement instanceof HTMLPreElement;
        this.copyButton = this.createCopyButton();
        this.wrapper = document.createElement('div');
        this.boundCopyContent = null;
        this.boundUpdateVisibility = null;
        this.appendCopyButton();
        this.addEventListeners();
        this.updateVisibility();
    }

    createCopyButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button'; // Prevent form submission when inside forms
        button.classList.add('copy-button');
        button.setAttribute('aria-label', 'Copy content to clipboard');
        button.setAttribute('title', 'Copy to clipboard');
        return button;
    }

    appendCopyButton(): void {
        // Create wrapper for the copy button
        this.wrapper.classList.add('copy-button-wrapper');
        this.targetElement.parentNode!.insertBefore(this.wrapper, this.targetElement);
        this.wrapper.appendChild(this.targetElement);
        this.wrapper.appendChild(this.copyButton);
    }

    addEventListeners(): void {
        // Store bound functions as instance properties for proper cleanup
        this.boundCopyContent = () => {
            void this.copyContent();
        };
        this.boundUpdateVisibility = () => {
            this.updateVisibility();
        };

        this.copyButton.addEventListener('click', this.boundCopyContent);

        if (this.isPreElement) {
            // For pre elements, use MutationObserver to detect content changes
            this.mutationObserver = new MutationObserver(() => {
                this.updateVisibility();
            });
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

    disconnect(): void {
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

    getContent(): string {
        if (this.targetElement instanceof HTMLPreElement) {
            return this.targetElement.textContent || '';
        }
        return this.targetElement.value;
    }

    async copyContent(): Promise<void> {
        const content = this.getContent();

        if (!content.trim()) {
            return;
        }

        // The Clipboard-API-then-execCommand sequence (including retrying the
        // synchronous path when the async one rejects) lives in
        // common/clipboard.ts; this component owns only the feedback.
        try {
            await copyTextToClipboard(content);
            this.showSuccessAnimation();
            this.dispatchCopyEvent(content);
        } catch (error) {
            console.error('All copy methods failed:', error);
            this.showErrorAnimation();
        }
    }

    showSuccessAnimation(): void {
        this.copyButton.classList.add('copy-success');
        this.copyButton.setAttribute('aria-label', 'Copied successfully!');

        // Remove the class after animation completes
        setTimeout(() => {
            this.copyButton.classList.remove('copy-success');
            this.copyButton.setAttribute('aria-label', 'Copy content to clipboard');
        }, 600);
    }

    showErrorAnimation(): void {
        this.copyButton.classList.add('copy-error');

        // Remove the class after animation completes
        setTimeout(() => {
            this.copyButton.classList.remove('copy-error');
        }, 600);
    }

    dispatchCopyEvent(content: string): void {
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

    updateVisibility(): this {
        const content = this.getContent();
        if (content.length > 0) {
            this.copyButton.style.display = 'block';
        } else {
            this.copyButton.style.display = 'none';
        }
        return this; // Allow method chaining
    }

    // Public method to force visibility update
    forceUpdateVisibility(): this {
        this.updateVisibility();
        return this; // Allow method chaining
    }
}

export default CopyButton;
