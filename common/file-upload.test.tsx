import { render } from 'preact';
import FileUploadButton from './file-upload';

describe('FileUploadButton', () => {
    it('pairs a visible button label with an accessible hidden file input', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(<FileUploadButton id="test-file" />, root);

        const input = root.querySelector('input[type="file"]');
        const label = root.querySelector('label');

        expect(input?.id).toBe('test-file');
        expect(input?.classList.contains('u-visually-hidden')).toBe(true);
        expect(label?.htmlFor).toBe('test-file');
        expect(label?.textContent).toBe('Upload File');
        expect(label?.classList.contains('c-button')).toBe(true);

        root.remove();
    });

    it('forwards tool-specific label styling and the input ref', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        let input: HTMLInputElement | undefined;

        render(
            <FileUploadButton
                id="custom-file"
                className="custom-upload-button"
                label="Choose File"
                accept="text/plain"
                ariaLabel="Choose a text file"
                inputRef={(node) => {
                    input = node;
                }}
            />,
            root
        );

        const label = root.querySelector('label');
        expect(input?.id).toBe('custom-file');
        expect(label?.htmlFor).toBe('custom-file');
        expect(label?.className).toBe('custom-upload-button');
        expect(label?.textContent).toBe('Choose File');
        expect(input?.getAttribute('accept')).toBe('text/plain');
        expect(input?.getAttribute('aria-label')).toBe('Choose a text file');

        root.remove();
    });
});
