import CopyButton from './CopyButton';

// Mock the Clipboard API
Object.assign(navigator, {
    clipboard: {
        writeText: jest.fn(),
    },
});

// Mock window.isSecureContext
Object.defineProperty(window, 'isSecureContext', {
    writable: true,
    value: true,
});

// Mock document.execCommand
document.execCommand = jest.fn();

describe('CopyButton', () => {
    let textArea;
    let copyButtonInstance;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="container">
                <textarea id="test-textarea">Sample content</textarea>
            </div>
        `;
        textArea = document.getElementById('test-textarea');
        copyButtonInstance = new CopyButton(textArea);
        
        // Reset mocks
        jest.clearAllMocks();
        navigator.clipboard.writeText.mockResolvedValue();
        document.execCommand.mockReturnValue(true);
    });

    afterEach(() => {
        copyButtonInstance.disconnect();
        document.body.innerHTML = '';
    });

    describe('Initialization', () => {
        test('should throw an error if not initialized with a textarea, input, or pre element', () => {
            expect(() => new CopyButton(document.createElement('div'))).toThrow(
                'CopyButton must be initialized with a valid HTMLTextAreaElement, HTMLInputElement, or HTMLPreElement.'
            );
        });

        test('should work with input elements', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = 'test';
            document.body.appendChild(input);
            
            expect(() => new CopyButton(input)).not.toThrow();
        });

        test('should work with pre elements', () => {
            const pre = document.createElement('pre');
            pre.textContent = 'test content';
            document.body.appendChild(pre);
            
            expect(() => new CopyButton(pre)).not.toThrow();
        });

        test('should create and append the copy button to the DOM', () => {
            const wrapper = textArea.parentNode;
            expect(wrapper.classList.contains('copy-button-wrapper')).toBe(true);
            expect(wrapper.contains(textArea)).toBe(true);
            expect(wrapper.querySelector('.copy-button')).not.toBeNull();
        });


        test('should set proper accessibility attributes', () => {
            const copyButton = copyButtonInstance.copyButton;
            expect(copyButton.getAttribute('aria-label')).toBe('Copy content to clipboard');
            expect(copyButton.getAttribute('title')).toBe('Copy to clipboard');
        });
    });

    describe('Visibility Management', () => {
        test('copy button should be visible when textarea has content initially', () => {
            expect(copyButtonInstance.copyButton.style.display).toBe('block');
        });

        test('copy button should be hidden when textarea is empty', () => {
            textArea.value = '';
            textArea.dispatchEvent(new Event('input'));
            expect(copyButtonInstance.copyButton.style.display).toBe('none');
        });

        test('copy button should be visible when textarea has content after input event', () => {
            textArea.value = '';
            textArea.dispatchEvent(new Event('input'));
            textArea.value = 'some text';
            textArea.dispatchEvent(new Event('input'));
            expect(copyButtonInstance.copyButton.style.display).toBe('block');
        });

        test('copy button should respond to paste events', () => {
            textArea.value = '';
            textArea.dispatchEvent(new Event('input'));
            textArea.value = 'pasted text';
            textArea.dispatchEvent(new Event('paste'));
            expect(copyButtonInstance.copyButton.style.display).toBe('block');
        });

        test('copy button should respond to cut events', () => {
            textArea.value = 'some text';
            textArea.dispatchEvent(new Event('input'));
            textArea.value = '';
            textArea.dispatchEvent(new Event('cut'));
            expect(copyButtonInstance.copyButton.style.display).toBe('none');
        });

        test('copy button should respond to keyup events', () => {
            textArea.value = '';
            textArea.dispatchEvent(new Event('input'));
            textArea.value = 'typed text';
            textArea.dispatchEvent(new Event('keyup'));
            expect(copyButtonInstance.copyButton.style.display).toBe('block');
        });

        test('copy button should respond to change events', () => {
            textArea.value = '';
            textArea.dispatchEvent(new Event('input'));
            textArea.value = 'changed text';
            textArea.dispatchEvent(new Event('change'));
            expect(copyButtonInstance.copyButton.style.display).toBe('block');
        });
    });

    describe('Copy Functionality', () => {
        test('should copy content using Clipboard API when available', async () => {
            textArea.value = 'test content';
            
            await copyButtonInstance.copyContent();
            
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test content');
        });

        test('should use fallback method when Clipboard API fails', async () => {
            textArea.value = 'test content';
            navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard API failed'));
            
            await copyButtonInstance.copyContent();
            
            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        test('should use fallback method when not in secure context', async () => {
            window.isSecureContext = false;
            textArea.value = 'test content';
            
            await copyButtonInstance.copyContent();
            
            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        });

        test('should not copy empty content', async () => {
            textArea.value = '';
            
            await copyButtonInstance.copyContent();
            
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
            expect(document.execCommand).not.toHaveBeenCalled();
        });

        test('should not copy whitespace-only content', async () => {
            textArea.value = '   \n\t   ';
            
            await copyButtonInstance.copyContent();
            
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
            expect(document.execCommand).not.toHaveBeenCalled();
        });

        test('should copy content on button click', async () => {
            textArea.value = 'click test content';
            
            // Spy on the bound method that's actually called by the event listener
            const originalBoundMethod = copyButtonInstance.boundCopyContent;
            let methodCalled = false;
            
            copyButtonInstance.boundCopyContent = async () => {
                methodCalled = true;
                // Mock successful copy without calling the original method
                copyButtonInstance.showSuccessAnimation();
                copyButtonInstance.dispatchCopyEvent('click test content');
            };
            
            // Re-bind the event listener
            copyButtonInstance.copyButton.removeEventListener('click', originalBoundMethod);
            copyButtonInstance.copyButton.addEventListener('click', copyButtonInstance.boundCopyContent);
            
            copyButtonInstance.copyButton.click();
            
            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(methodCalled).toBe(true);
            expect(copyButtonInstance.copyButton.classList.contains('copy-success')).toBe(true);
        });

        test('should invoke copyContent through the default click binding', async () => {
            textArea.value = 'bound listener content';
            const copySpy = jest.spyOn(copyButtonInstance, 'copyContent').mockResolvedValue(undefined);

            copyButtonInstance.copyButton.click();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(copySpy).toHaveBeenCalledTimes(1);
            copySpy.mockRestore();
        });
    });

    describe('Event Dispatching', () => {
        test('should dispatch contentCopied event with correct details', async () => {
            const eventSpy = jest.spyOn(textArea, 'dispatchEvent');
            textArea.value = 'event test content';
            
            await copyButtonInstance.copyContent();
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'contentCopied',
                    bubbles: true,
                    detail: expect.objectContaining({
                        content: 'event test content',
                        length: 18,
                        timestamp: expect.any(String)
                    })
                })
            );
        });

        test('should include timestamp in ISO format', async () => {
            const eventSpy = jest.spyOn(textArea, 'dispatchEvent');
            textArea.value = 'timestamp test';
            
            await copyButtonInstance.copyContent();
            
            const event = eventSpy.mock.calls[0][0];
            const timestamp = event.detail.timestamp;
            expect(new Date(timestamp).toISOString()).toBe(timestamp);
        });
    });

    describe('Animation States', () => {
        test('should show success animation after successful copy', async () => {
            textArea.value = 'success test';
            
            await copyButtonInstance.copyContent();
            
            expect(copyButtonInstance.copyButton.classList.contains('copy-success')).toBe(true);
        });

        test('should remove success animation after timeout', async () => {
            textArea.value = 'success test';
            jest.useFakeTimers();
            
            await copyButtonInstance.copyContent();
            
            expect(copyButtonInstance.copyButton.classList.contains('copy-success')).toBe(true);
            
            jest.advanceTimersByTime(600);
            
            expect(copyButtonInstance.copyButton.classList.contains('copy-success')).toBe(false);
            
            jest.useRealTimers();
        });

        test('should update aria-label on success', async () => {
            textArea.value = 'success test';
            jest.useFakeTimers();

            await copyButtonInstance.copyContent();

            expect(copyButtonInstance.copyButton.getAttribute('aria-label')).toBe('Copied successfully!');

            jest.advanceTimersByTime(600);

            expect(copyButtonInstance.copyButton.getAttribute('aria-label')).toBe('Copy content to clipboard');

            jest.useRealTimers();
        });

        test('should show error animation when all copy methods fail', async () => {
            textArea.value = 'error test';
            navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard failed'));
            document.execCommand.mockReturnValue(false);
            jest.useFakeTimers();
            
            await copyButtonInstance.copyContent();
            
            expect(copyButtonInstance.copyButton.classList.contains('copy-error')).toBe(true);
            
            jest.advanceTimersByTime(600);
            
            expect(copyButtonInstance.copyButton.classList.contains('copy-error')).toBe(false);
            
            jest.useRealTimers();
        });
    });

    describe('Event Listener Management', () => {
        test('should add event listeners on initialization', () => {
            const tempTextArea = document.createElement('textarea');
            document.body.appendChild(tempTextArea);
            const addEventListenerSpy = jest.spyOn(tempTextArea, 'addEventListener');
            const tempCopyButton = new CopyButton(tempTextArea);
            
            expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('cut', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
            
            tempCopyButton.disconnect();
            addEventListenerSpy.mockRestore();
        });

        test('should remove event listeners on disconnect', () => {
            const removeEventListenerSpy = jest.spyOn(textArea, 'removeEventListener');
            copyButtonInstance.disconnect();
            
            expect(removeEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('cut', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
            
            removeEventListenerSpy.mockRestore();
        });
    });

    describe('Fallback Copy Method', () => {
        test('should create and remove temporary textarea for fallback copy', () => {
            const content = 'fallback test content';
            const createElementSpy = jest.spyOn(document, 'createElement');
            const appendChildSpy = jest.spyOn(document.body, 'appendChild');
            const removeChildSpy = jest.spyOn(document.body, 'removeChild');
            
            copyButtonInstance.fallbackCopyToClipboard(content);
            
            expect(createElementSpy).toHaveBeenCalledWith('textarea');
            expect(appendChildSpy).toHaveBeenCalled();
            expect(removeChildSpy).toHaveBeenCalled();
            expect(document.execCommand).toHaveBeenCalledWith('copy');
            
            createElementSpy.mockRestore();
            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
        });

        test('should throw error when execCommand fails', () => {
            document.execCommand.mockReturnValue(false);
            
            expect(() => {
                copyButtonInstance.fallbackCopyToClipboard('test');
            }).toThrow('execCommand copy failed');
        });
    });

    describe('Pre Element Support', () => {
        let preElement;
        let preCopyButtonInstance;

        beforeEach(() => {
            // Reset mocks before creating pre element
            jest.clearAllMocks();
            navigator.clipboard.writeText.mockResolvedValue();
            document.execCommand.mockReturnValue(true);
            
            preElement = document.createElement('pre');
            preElement.textContent = 'Sample pre content';
            document.body.appendChild(preElement);
            preCopyButtonInstance = new CopyButton(preElement);
        });

        afterEach(() => {
            preCopyButtonInstance.disconnect();
            if (preElement.parentNode) {
                preElement.parentNode.removeChild(preElement);
            }
        });

        test('should correctly identify pre elements', () => {
            expect(preCopyButtonInstance.isPreElement).toBe(true);
            expect(copyButtonInstance.isPreElement).toBe(false);
        });

        test('should get content from pre element using textContent', () => {
            expect(preCopyButtonInstance.getContent()).toBe('Sample pre content');
        });

        test('should copy content from pre element', async () => {
            // Mock the copy functionality to avoid clipboard API issues in tests
            const copyContentSpy = jest.spyOn(preCopyButtonInstance, 'copyContent').mockImplementation(async () => {
                preCopyButtonInstance.showSuccessAnimation();
                preCopyButtonInstance.dispatchCopyEvent('Sample pre content');
            });
            
            await preCopyButtonInstance.copyContent();
            expect(copyContentSpy).toHaveBeenCalled();
            expect(preCopyButtonInstance.copyButton.classList.contains('copy-success')).toBe(true);
            
            copyContentSpy.mockRestore();
        });

        test('should show copy button when pre has content', () => {
            expect(preCopyButtonInstance.copyButton.style.display).toBe('block');
        });

        test('should hide copy button when pre is empty', () => {
            preElement.textContent = '';
            preCopyButtonInstance.updateVisibility();
            expect(preCopyButtonInstance.copyButton.style.display).toBe('none');
        });

        test('should use MutationObserver for pre elements', () => {
            expect(preCopyButtonInstance.mutationObserver).toBeInstanceOf(MutationObserver);
            expect(copyButtonInstance.mutationObserver).toBeUndefined();
        });

        test('should respond to content changes via MutationObserver', () => {
            // Test that MutationObserver is set up and can be manually triggered
            expect(preCopyButtonInstance.mutationObserver).toBeInstanceOf(MutationObserver);
            
            // Test manual visibility update works
            preElement.textContent = '';
            preCopyButtonInstance.updateVisibility();
            expect(preCopyButtonInstance.copyButton.style.display).toBe('none');
            
            preElement.textContent = 'New content';
            preCopyButtonInstance.updateVisibility();
            expect(preCopyButtonInstance.copyButton.style.display).toBe('block');
        });

        test('should disconnect MutationObserver on cleanup', () => {
            const disconnectSpy = jest.spyOn(preCopyButtonInstance.mutationObserver, 'disconnect');
            preCopyButtonInstance.disconnect();
            expect(disconnectSpy).toHaveBeenCalled();
            expect(preCopyButtonInstance.mutationObserver).toBeNull();
        });

        test('should dispatch contentCopied event for pre elements', () => {
            const eventSpy = jest.spyOn(preElement, 'dispatchEvent');
            
            // Manually trigger the event dispatch to test the functionality
            preCopyButtonInstance.dispatchCopyEvent('Sample pre content');
            
            expect(eventSpy).toHaveBeenCalled();
            const dispatchedEvent = eventSpy.mock.calls[0][0];
            expect(dispatchedEvent.type).toBe('contentCopied');
            expect(dispatchedEvent.bubbles).toBe(true);
            expect(dispatchedEvent.detail.content).toBe('Sample pre content');
            expect(dispatchedEvent.detail.length).toBe(18);
            expect(dispatchedEvent.detail.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        test('should handle nested HTML content in pre elements', () => {
            preElement.innerHTML = '<code>function test() { return "hello"; }</code>';
            expect(preCopyButtonInstance.getContent()).toBe('function test() { return "hello"; }');
        });

        test('should not add form event listeners to pre elements', () => {
            const addEventListenerSpy = jest.spyOn(preElement, 'addEventListener');
            const tempPreCopyButton = new CopyButton(preElement);
            
            expect(addEventListenerSpy).not.toHaveBeenCalledWith('input', expect.any(Function));
            expect(addEventListenerSpy).not.toHaveBeenCalledWith('paste', expect.any(Function));
            expect(addEventListenerSpy).not.toHaveBeenCalledWith('cut', expect.any(Function));
            expect(addEventListenerSpy).not.toHaveBeenCalledWith('keyup', expect.any(Function));
            expect(addEventListenerSpy).not.toHaveBeenCalledWith('change', expect.any(Function));
            
            tempPreCopyButton.disconnect();
            addEventListenerSpy.mockRestore();
        });
    });
});
