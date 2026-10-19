import { analyticsFileType, analyticsFileTypeFromFilename } from './analytics-file-type';

describe('analyticsFileType', () => {
    it('uses the file extension and never the full name', () => {
        expect(analyticsFileType(new File(['{}'], 'notes.json', { type: 'application/json' }))).toBe('json');
        expect(analyticsFileType(new File([''], 'no-extension', { type: 'text/plain' }))).toBe('plain');
        expect(analyticsFileType(new File([''], 'no-extension', { type: '' }))).toBe('unknown');
    });
});

describe('analyticsFileTypeFromFilename', () => {
    it('returns only the extension from a suggested download name', () => {
        expect(analyticsFileTypeFromFilename('formatted-output.json')).toBe('json');
        expect(analyticsFileTypeFromFilename('patch')).toBe('unknown');
    });
});
