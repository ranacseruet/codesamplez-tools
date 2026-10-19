const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Coarse file type for analytics from a `File` — extension or MIME subtype only,
 * never the file name or contents.
 */
export function analyticsFileType(file: File): string {
    const name = file.name;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0 && dotIndex < name.length - 1) {
        const extension = name.slice(dotIndex + 1).toLowerCase();
        if (IDENTIFIER_PATTERN.test(extension)) {
            return extension;
        }
    }

    const mime = file.type;
    if (mime) {
        const slashIndex = mime.indexOf('/');
        if (slashIndex !== -1) {
            const subtype = mime.slice(slashIndex + 1).split('+')[0]?.toLowerCase() ?? '';
            if (IDENTIFIER_PATTERN.test(subtype)) {
                return subtype;
            }
        }
    }

    return 'unknown';
}

/**
 * Coarse download type from a suggested filename — extension only.
 */
export function analyticsFileTypeFromFilename(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex > 0 && dotIndex < filename.length - 1) {
        const extension = filename.slice(dotIndex + 1).toLowerCase();
        if (IDENTIFIER_PATTERN.test(extension)) {
            return extension;
        }
    }

    return 'unknown';
}
