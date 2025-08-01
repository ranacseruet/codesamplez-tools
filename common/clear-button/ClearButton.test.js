import ClearButton from './ClearButton';

describe('ClearButton', () => {
    let textArea;
    let clearButtonInstance;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="container">
                <textarea id="test-textarea"></textarea>
            </div>
        `;
        textArea = document.getElementById('test-textarea');
        clearButtonInstance = new ClearButton(textArea);
    });

    afterEach(() => {
        clearButtonInstance.disconnect(); // Clean up event listeners
        document.body.innerHTML = '';
    });

    test('should throw an error if not initialized with a textarea element', () => {
        expect(() => new ClearButton(document.createElement('div'))).toThrow(
            'ClearButton must be initialized with a valid HTMLTextAreaElement.'
        );
    });

    test('should create and append the clear button to the DOM', () => {
        const wrapper = textArea.parentNode;
        expect(wrapper.classList.contains('clear-button-wrapper')).toBe(true);
        expect(wrapper.contains(textArea)).toBe(true);
        expect(wrapper.querySelector('.clear-button')).not.toBeNull();
    });

    test('clear button should be hidden when textarea is empty initially', () => {
        expect(clearButtonInstance.clearButton.style.display).toBe('none');
    });

    test('clear button should be visible when textarea has content after input event', () => {
        textArea.value = 'some text';
        textArea.dispatchEvent(new Event('input'));
        expect(clearButtonInstance.clearButton.style.display).toBe('block');
    });

    test('clear button should be hidden when textarea is cleared after input event', () => {
        textArea.value = 'some text';
        textArea.dispatchEvent(new Event('input'));
        textArea.value = '';
        textArea.dispatchEvent(new Event('input'));
        expect(clearButtonInstance.clearButton.style.display).toBe('none');
    });

    test('clear button should respond to paste events', () => {
        textArea.value = 'pasted text';
        textArea.dispatchEvent(new Event('paste'));
        expect(clearButtonInstance.clearButton.style.display).toBe('block');
    });

    test('clear button should respond to cut events', () => {
        textArea.value = 'some text';
        textArea.dispatchEvent(new Event('input')); // Make button visible first
        textArea.value = '';
        textArea.dispatchEvent(new Event('cut'));
        expect(clearButtonInstance.clearButton.style.display).toBe('none');
    });

    test('clear button should respond to keyup events', () => {
        textArea.value = 'typed text';
        textArea.dispatchEvent(new Event('keyup'));
        expect(clearButtonInstance.clearButton.style.display).toBe('block');
    });

    test('clear button should respond to change events', () => {
        textArea.value = 'changed text';
        textArea.dispatchEvent(new Event('change'));
        expect(clearButtonInstance.clearButton.style.display).toBe('block');
    });

    test('should clear textarea content on button click', () => {
        textArea.value = 'initial text';
        textArea.dispatchEvent(new Event('input')); // Make button visible
        clearButtonInstance.clearButton.click();
        expect(textArea.value).toBe('');
        expect(clearButtonInstance.clearButton.style.display).toBe('none');
    });

    test('should focus textarea after clearing content', () => {
        textArea.value = 'initial text';
        textArea.dispatchEvent(new Event('input'));
        const focusSpy = jest.spyOn(textArea, 'focus');
        clearButtonInstance.clearButton.click();
        expect(focusSpy).toHaveBeenCalled();
        focusSpy.mockRestore();
    });

    test('should dispatch an input event after clearing content', () => {
        const dispatchEventSpy = jest.spyOn(textArea, 'dispatchEvent');
        textArea.value = 'initial text';
        textArea.dispatchEvent(new Event('input'));
        clearButtonInstance.clearButton.click();
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
        expect(dispatchEventSpy.mock.calls[0][0].type).toBe('input');
        dispatchEventSpy.mockRestore();
    });

    test('should add event listeners on initialization', () => {
        const tempTextArea = document.createElement('textarea');
        document.body.appendChild(tempTextArea);
        const addEventListenerSpy = jest.spyOn(tempTextArea, 'addEventListener');
        const tempClearButton = new ClearButton(tempTextArea);
        
        expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('cut', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
        
        tempClearButton.disconnect();
        addEventListenerSpy.mockRestore();
    });

    test('should remove event listeners on disconnect', () => {
        const removeEventListenerSpy = jest.spyOn(textArea, 'removeEventListener');
        clearButtonInstance.disconnect();
        
        expect(removeEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('cut', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
        
        removeEventListenerSpy.mockRestore();
    });
});
