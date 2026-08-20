import { waitFor } from '@testing-library/dom';
import {
    DROP_ZONE_ACTIVE_CLASS,
    registerDropZone,
    readFileAsText,
    type DropZoneCleanup,
} from './drop-zone';

interface FakeDataTransfer {
    types: string[];
    files: File[];
    dropEffect: string;
}

function fileDrag(files: File[] = []): FakeDataTransfer {
    return { types: ['Files'], files, dropEffect: '' };
}

function textDrag(): FakeDataTransfer {
    return { types: ['text/plain'], files: [], dropEffect: '' };
}

/**
 * jsdom has no `DragEvent` constructor, so synthesise one: a cancelable event
 * carrying a `dataTransfer` stand-in shaped like the members the module reads.
 */
function fire(target: EventTarget, type: string, dataTransfer: FakeDataTransfer | null): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(event);
    return event;
}

/**
 * Let `file.text()` and the module's own `.then` chain settle. jsdom resolves
 * a Blob read over more than one turn, so a single macrotask is not enough
 * under load — positive assertions use `waitFor`, and this is only for
 * confirming that nothing happened.
 */
async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('registerDropZone', () => {
    let target: HTMLTextAreaElement;
    let cleanup: DropZoneCleanup | undefined;

    beforeEach(() => {
        target = document.createElement('textarea');
        document.body.appendChild(target);
    });

    afterEach(() => {
        cleanup?.();
        cleanup = undefined;
        target.remove();
    });

    it('reads a dropped text file and hands the contents to onText', async () => {
        const onText = jest.fn();
        cleanup = registerDropZone(target, { onText });
        const file = new File(['{"a":1}'], 'data.json', { type: 'application/json' });

        fire(target, 'drop', fileDrag([file]));

        await waitFor(() => expect(onText).toHaveBeenCalledWith('{"a":1}', file));
    });

    it('hands the raw File to onFile without reading it', () => {
        const onFile = jest.fn();
        cleanup = registerDropZone(target, { onFile });
        const file = new File(['binary-ish'], 'image.png', { type: 'image/png' });

        fire(target, 'drop', fileDrag([file]));

        expect(onFile).toHaveBeenCalledWith(file);
    });

    it('highlights the target while a file drag hovers it', () => {
        cleanup = registerDropZone(target, { onText: jest.fn() });

        fire(target, 'dragenter', fileDrag());
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(true);

        fire(target, 'dragleave', fileDrag());
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
    });

    it('keeps the highlight until the last nested dragleave', () => {
        cleanup = registerDropZone(target, { onText: jest.fn() });

        fire(target, 'dragenter', fileDrag());
        fire(target, 'dragenter', fileDrag());
        fire(target, 'dragleave', fileDrag());

        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(true);

        fire(target, 'dragleave', fileDrag());
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
    });

    it('marks dragover as a copy and accepts the drop', () => {
        cleanup = registerDropZone(target, { onText: jest.fn() });
        const dataTransfer = fileDrag();

        const event = fire(target, 'dragover', dataTransfer);

        expect(event.defaultPrevented).toBe(true);
        expect(dataTransfer.dropEffect).toBe('copy');
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(true);
    });

    it('clears the highlight after a drop', () => {
        cleanup = registerDropZone(target, { onText: jest.fn() });

        fire(target, 'dragenter', fileDrag());
        fire(target, 'drop', fileDrag([new File(['x'], 'x.txt')]));

        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
    });

    it('leaves text-selection drags to the browser', async () => {
        const onText = jest.fn();
        cleanup = registerDropZone(target, { onText });

        fire(target, 'dragenter', textDrag());
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);

        const dropEvent = fire(target, 'drop', textDrag());
        await flush();

        // Swallowing this would break dragging a selection into the field.
        expect(dropEvent.defaultPrevented).toBe(false);
        expect(onText).not.toHaveBeenCalled();
    });

    it('rejects a file over the size limit', async () => {
        const onText = jest.fn();
        const onError = jest.fn();
        cleanup = registerDropZone(target, { onText, onError, maxBytes: 4 });

        fire(target, 'drop', fileDrag([new File(['much too long'], 'big.txt')]));

        await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('big.txt')));
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('too large'));
        expect(onText).not.toHaveBeenCalled();
    });

    it('reports the limit in whole megabytes by default', async () => {
        const onError = jest.fn();
        cleanup = registerDropZone(target, { onText: jest.fn(), onError });
        const oversized = new File(['x'], 'huge.txt');
        Object.defineProperty(oversized, 'size', { value: 6 * 1024 * 1024 });

        fire(target, 'drop', fileDrag([oversized]));

        await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('limit 5 MB')));
    });

    it('rejects binary content on the text path', async () => {
        const onText = jest.fn();
        const onError = jest.fn();
        cleanup = registerDropZone(target, { onText, onError });

        fire(target, 'drop', fileDrag([new File(['PNG\u0000\u0000data'], 'logo.png')]));

        await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('binary file')));
        expect(onText).not.toHaveBeenCalled();
    });

    it('reports a drop that carries no file', () => {
        const onError = jest.fn();
        cleanup = registerDropZone(target, { onText: jest.fn(), onError });

        fire(target, 'drop', fileDrag([]));

        expect(onError).toHaveBeenCalledWith(expect.stringContaining('No file'));
    });

    it('reports an unreadable file', async () => {
        const onText = jest.fn();
        const onError = jest.fn();
        cleanup = registerDropZone(target, { onText, onError });
        const file = new File(['x'], 'locked.txt');
        Object.defineProperty(file, 'text', {
            value: () => Promise.reject(new Error('nope')),
        });

        fire(target, 'drop', fileDrag([file]));

        await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('Could not read')));
        expect(onText).not.toHaveBeenCalled();
    });

    it('ignores drag events that carry no dataTransfer at all', () => {
        const onText = jest.fn();
        cleanup = registerDropZone(target, { onText });

        const enter = fire(target, 'dragenter', null);
        const drop = fire(target, 'drop', null);

        expect(enter.defaultPrevented).toBe(false);
        expect(drop.defaultPrevented).toBe(false);
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
        expect(onText).not.toHaveBeenCalled();
    });

    it('treats a dataTransfer with no types as carrying no files', () => {
        cleanup = registerDropZone(target, { onText: jest.fn() });

        // Some browsers hand back an undefined `types` on synthetic drags.
        fire(target, 'dragenter', { files: [], dropEffect: '' } as unknown as FakeDataTransfer);

        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
    });

    it('highlights on dragover even when dragenter never fired', () => {
        cleanup = registerDropZone(target, { onText: jest.fn() });

        fire(target, 'dragover', fileDrag());
        // The matching dragleave must still clear it — the depth counter has to
        // have been seeded by dragover rather than left at zero.
        fire(target, 'dragleave', fileDrag());

        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
    });

    /** A file whose read resolves (or rejects) only when the test says so. */
    function deferredFile(name: string, contents: string) {
        let settle!: (value: string) => void;
        let fail!: (reason: unknown) => void;
        const pending = new Promise<string>((resolve, reject) => {
            settle = resolve;
            fail = reject;
        });
        const file = new File([contents], name);
        Object.defineProperty(file, 'text', { value: () => pending });
        return { file, resolve: () => settle(contents), reject: () => fail(new Error('boom')) };
    }

    it('ignores a read that finishes after cleanup', async () => {
        const onText = jest.fn();
        const slow = deferredFile('slow.txt', 'late contents');
        cleanup = registerDropZone(target, { onText });

        fire(target, 'drop', fileDrag([slow.file]));
        // Stand-in for a re-registration: css-minifier, js-minifier, and
        // data-format-converter tear their zone down when settings change.
        cleanup();
        cleanup = undefined;
        slow.resolve();
        await flush();

        expect(onText).not.toHaveBeenCalled();
    });

    it('applies only the most recent of two overlapping drops', async () => {
        const onText = jest.fn();
        const slow = deferredFile('big.txt', 'first dropped, resolves last');
        const quick = deferredFile('small.txt', 'second dropped, resolves first');
        cleanup = registerDropZone(target, { onText });

        fire(target, 'drop', fileDrag([slow.file]));
        fire(target, 'drop', fileDrag([quick.file]));

        quick.resolve();
        await flush();
        // The earlier, slower read must not overwrite the newer one.
        slow.resolve();
        await flush();

        expect(onText).toHaveBeenCalledTimes(1);
        expect(onText).toHaveBeenCalledWith('second dropped, resolves first', quick.file);
    });

    it('stays silent when a superseded read fails', async () => {
        const onText = jest.fn();
        const onError = jest.fn();
        const slow = deferredFile('big.txt', 'never applied');
        const quick = deferredFile('small.txt', 'winner');
        cleanup = registerDropZone(target, { onText, onError });

        fire(target, 'drop', fileDrag([slow.file]));
        fire(target, 'drop', fileDrag([quick.file]));

        quick.resolve();
        await flush();
        slow.reject();
        await flush();

        expect(onError).not.toHaveBeenCalled();
        expect(onText).toHaveBeenCalledWith('winner', quick.file);
    });

    it('honours a custom active class', () => {
        cleanup = registerDropZone(target, { onText: jest.fn(), activeClass: 'dropping' });

        fire(target, 'dragenter', fileDrag());

        expect(target.classList.contains('dropping')).toBe(true);
        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);
    });

    it('stops responding after cleanup', async () => {
        const onText = jest.fn();
        cleanup = registerDropZone(target, { onText });
        fire(target, 'dragenter', fileDrag());

        cleanup();
        cleanup = undefined;

        expect(target.classList.contains(DROP_ZONE_ACTIVE_CLASS)).toBe(false);

        fire(target, 'drop', fileDrag([new File(['x'], 'x.txt')]));
        await flush();

        expect(onText).not.toHaveBeenCalled();
    });
});

describe('stray-drop document guard', () => {
    let target: HTMLTextAreaElement;

    beforeEach(() => {
        target = document.createElement('textarea');
        document.body.appendChild(target);
    });

    afterEach(() => {
        target.remove();
    });

    it('stops a file dropped outside the zone from navigating the page', () => {
        const cleanup = registerDropZone(target, { onText: jest.fn() });
        const elsewhere = document.createElement('div');
        document.body.appendChild(elsewhere);

        const dropEvent = fire(elsewhere, 'drop', fileDrag([new File(['x'], 'x.txt')]));
        const dragOver = fileDrag();
        fire(elsewhere, 'dragover', dragOver);

        expect(dropEvent.defaultPrevented).toBe(true);
        expect(dragOver.dropEffect).toBe('none');

        cleanup();
        elsewhere.remove();
    });

    it('leaves non-file drags outside the zone alone', () => {
        const cleanup = registerDropZone(target, { onText: jest.fn() });
        const elsewhere = document.createElement('div');
        document.body.appendChild(elsewhere);

        const dropEvent = fire(elsewhere, 'drop', textDrag());

        expect(dropEvent.defaultPrevented).toBe(false);

        cleanup();
        elsewhere.remove();
    });

    it('restores native behavior once every zone is cleaned up', () => {
        const first = registerDropZone(target, { onText: jest.fn() });
        const second = registerDropZone(document.createElement('textarea'), { onText: jest.fn() });
        const elsewhere = document.createElement('div');
        document.body.appendChild(elsewhere);

        first();
        // One zone is still registered, so the guard must stay installed.
        expect(fire(elsewhere, 'drop', fileDrag([new File(['x'], 'x.txt')])).defaultPrevented).toBe(true);

        second();
        expect(fire(elsewhere, 'drop', fileDrag([new File(['x'], 'x.txt')])).defaultPrevented).toBe(false);

        elsewhere.remove();
    });
});

describe('readFileAsText', () => {
    it('falls back to FileReader when Blob.text is unavailable', async () => {
        const file = new File(['fallback contents'], 'legacy.txt');
        Object.defineProperty(file, 'text', { value: undefined });

        await expect(readFileAsText(file)).resolves.toBe('fallback contents');
    });

    it('rejects when the FileReader fallback fails', async () => {
        const file = new File(['x'], 'legacy.txt');
        Object.defineProperty(file, 'text', { value: undefined });
        jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (
            this: FileReader
        ) {
            this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
        });

        await expect(readFileAsText(file)).rejects.toThrow();

        jest.restoreAllMocks();
    });
});
