import type { JSX, Ref } from 'preact';

export const TEXT_FILE_ACCEPT = 'text/*,.json,.js,.xml,.yaml,.yml,.csv';

export interface FileUploadButtonProps {
    id: string;
    className?: string;
    label?: string;
    inputRef?: Ref<HTMLInputElement>;
    accept?: string;
    ariaLabel?: string;
}

/**
 * Shared visible file-picker control. File handling is registered by the
 * owning tool through `registerFileInput` so picker and drop-zone callbacks
 * remain on the same path.
 */
export function FileUploadButton({
    id,
    className = 'c-button c-button--secondary',
    label = 'Upload File',
    inputRef,
    accept,
    ariaLabel
}: FileUploadButtonProps): JSX.Element {
    return (
        <span className="c-file-upload-control">
            <input
                ref={inputRef}
                type="file"
                id={id}
                className="u-visually-hidden"
                accept={accept}
                aria-label={ariaLabel}
            />
            <label className={className} htmlFor={id}>
                {label}
            </label>
        </span>
    );
}

export default FileUploadButton;
