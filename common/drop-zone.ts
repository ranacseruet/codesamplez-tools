/**
 * Shared file loading for tool inputs (UI v4 Phase D).
 *
 * Contract: every tool whose primary input is a text field accepts a dropped
 * file as an alternative to pasting. Drop targets highlight while a file is
 * dragged over them, picker and drop files are read locally (never uploaded —
 * these tools are client-side by design), and the tool receives either the
 * decoded text or the raw `File`.
 *
 * Two behaviours here are deliberate rather than incidental:
 *
 * - **Text drags are left alone.** A drag that carries no files (dragging a
 *   text selection into a textarea, which browsers handle natively) is ignored
 *   entirely, including its `drop` — swallowing it would break editing.
 * - **Stray drops can't navigate the page away.** Advertising drag-and-drop
 *   means users will sometimes miss the target, and the browser's default for a
 *   file dropped anywhere else is to open it, discarding whatever the user had
 *   typed. A ref-counted document-level guard neutralises those misses for as
 *   long as at least one drop zone is registered.
 */

import { formatBytes } from './format-utils';

export type DropZoneCleanup = () => void;

/**
 * Default ceiling for a dropped file. These tools all operate on
 * hand-authored text (JSON, CSS, JS, prose, diffs); anything past a few MB is
 * far more likely to be a mis-drop than real input, and reading it would jank
 * the main thread before the tool could reject it.
 */
export const DROP_ZONE_MAX_BYTES = 5 * 1024 * 1024;

/** Class toggled on the target while a file drag hovers it. */
export const DROP_ZONE_ACTIVE_CLASS = 'is-drop-active';

/** Attribute set on a registered target for the lifetime of the registration. */
export const DROP_ZONE_TARGET_ATTRIBUTE = 'data-drop-target';

interface DropZoneBaseOptions {
    /** Reported for rejected or unreadable drops. Tools surface this as a toast. */
    onError?: (message: string) => void;
    /** Overrides `DROP_ZONE_MAX_BYTES`. */
    maxBytes?: number;
    /** Overrides `DROP_ZONE_ACTIVE_CLASS`. */
    activeClass?: string;
}

/**
 * Context about the drop or pick that produced a file. Only the first file of
 * a multi-file drop is loaded; `ignoredFileCount` says how many were skipped
 * so the tool's own "Loaded …" toast can say so (see `describeLoadedFile`).
 */
export interface LoadedFileDetail {
    ignoredFileCount: number;
}

/**
 * Handlers are mutually exclusive: `onText` gets the decoded contents (and the
 * module applies the binary-content guard), while `onFile` hands over the raw
 * `File` unread, for tools like base64-converter that have their own
 * binary-aware reader.
 */
export type DropZoneOptions = DropZoneBaseOptions &
    (
        | { onText: (text: string, file: File, detail: LoadedFileDetail) => void; onFile?: never }
        | { onFile: (file: File, detail: LoadedFileDetail) => void; onText?: never }
    );

/**
 * The success message for a loaded file: "Loaded notes.txt", plus a note when
 * other files in the same drop were skipped. Tools share one notification
 * element, so the skip note rides along with the load toast rather than being
 * a separate toast the load message would immediately replace.
 */
export function describeLoadedFile(label: string, detail?: LoadedFileDetail): string {
    const ignored = detail?.ignoredFileCount ?? 0;
    if (ignored <= 0) {
        return `Loaded ${label}`;
    }

    return `Loaded ${label}. Only one file is used at a time, so ${ignored} other ${ignored === 1 ? 'file was' : 'files were'} ignored.`;
}

/**
 * True when a drag carries at least one file, as opposed to text or nothing.
 *
 * Deliberately an index loop rather than `Array.from(types).includes(...)`:
 * `Array.from` and `Array#includes` both pull core-js polyfills (and the whole
 * iterator-protocol chain behind `Array.from`) into every tool bundle that
 * imports this module — ~15KB of main-bundle growth for one membership test.
 */
function dragCarriesFiles(dataTransfer: DataTransfer | null): boolean {
    // `types` is the only member reliably readable during dragover — `files` is
    // empty until the drop event fires in most browsers.
    const types = dataTransfer?.types;
    if (!types) return false;
    for (let index = 0; index < types.length; index += 1) {
        if (types[index] === 'Files') return true;
    }
    return false;
}

// --- Document-level guard against stray file drops -------------------------
// Shared by every registered zone; installed on the first registration and
// removed with the last so a page with no drop zones keeps native behaviour.

let activeZoneCount = 0;
let documentGuardCleanup: DropZoneCleanup | null = null;

function installDocumentGuard(): void {
    if (documentGuardCleanup) return;

    const swallowStrayFileDrag = (event: DragEvent) => {
        if (!dragCarriesFiles(event.dataTransfer)) return;
        // A zone that handled the event already called preventDefault; anything
        // still travelling to the document missed every target.
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (event.type === 'dragover' && event.dataTransfer) {
            event.dataTransfer.dropEffect = 'none';
        }
    };

    document.addEventListener('dragover', swallowStrayFileDrag);
    document.addEventListener('drop', swallowStrayFileDrag);

    documentGuardCleanup = () => {
        document.removeEventListener('dragover', swallowStrayFileDrag);
        document.removeEventListener('drop', swallowStrayFileDrag);
    };
}

function releaseDocumentGuard(): void {
    if (activeZoneCount > 0 || !documentGuardCleanup) return;
    documentGuardCleanup();
    documentGuardCleanup = null;
}

/**
 * Process one accepted file using the same validation and text-reading path
 * for both drag-and-drop and the visible file picker. The read-state factory
 * runs only after the cheap size check so a rejected file cannot supersede a
 * read that is already in flight.
 */
function processFile(
    file: File,
    detail: LoadedFileDetail,
    options: DropZoneOptions,
    beginRead: () => () => boolean
): void {
    const maxBytes = options.maxBytes ?? DROP_ZONE_MAX_BYTES;

    if (file.size > maxBytes) {
        options.onError?.(`"${file.name}" is too large to load (limit ${formatBytes(maxBytes)}).`);
        return;
    }

    const isStale = beginRead();

    if (options.onFile) {
        if (!isStale()) {
            options.onFile(file, detail);
        }
        return;
    }

    const onText = options.onText;
    void readFileAsText(file)
        .then((text) => {
            if (isStale()) return;
            // A dropped image or archive decodes to mojibake rather than
            // failing, and NUL bytes are the cheapest reliable tell.
            // `indexOf` avoids the `String#includes` core-js polyfill.
            if (text.indexOf('\u0000') !== -1) {
                options.onError?.(`"${file.name}" looks like a binary file. Use a text file instead.`);
                return;
            }
            onText(text, file, detail);
        })
        .catch(() => {
            // A superseded or disposed read reports nothing: the user has
            // already moved on, and the toast would describe a file they no
            // longer care about.
            if (isStale()) return;
            options.onError?.(`Could not read "${file.name}".`);
        });
}

/**
 * Wire drag-and-drop file loading onto `target`. Returns a cleanup function
 * that removes every listener and releases the shared document guard.
 */
export function registerDropZone(target: HTMLElement, options: DropZoneOptions): DropZoneCleanup {
    const activeClass = options.activeClass ?? DROP_ZONE_ACTIVE_CLASS;
    const maxBytes = options.maxBytes ?? DROP_ZONE_MAX_BYTES;

    // `dragenter`/`dragleave` fire again for every descendant the pointer
    // crosses, so a boolean would flicker the highlight on targets that have
    // children. Counting enters and leaves keeps it stable.
    let dragDepth = 0;

    // Reading a file is asynchronous, so a result can arrive after its zone
    // stopped being the current one. Removing the listeners in `cleanup` does
    // not cancel an in-flight read, and the resolved callback still closes over
    // the handlers (and therefore the tool settings) captured at registration
    // time. Two cases this guards, both reachable in normal use:
    //
    // - **Superseded registration.** css-minifier, js-minifier, and
    //   data-format-converter re-register when their options change, so
    //   toggling a setting while a large file is still being read would
    //   otherwise apply the file using the *previous* settings.
    // - **Out-of-order drops.** Dropping a large file and then a small one
    //   would otherwise apply them in resolution order, leaving the tool
    //   showing the first file's contents.
    //
    // A superseded read is discarded rather than re-dispatched, so toggling an
    // option while a large file is mid-read drops that file on the floor and
    // the user re-drops. That is the deliberate trade: silently applying a file
    // under settings the user has already changed is the worse outcome.
    let disposed = false;
    let latestReadId = 0;

    const setActive = (isActive: boolean) => {
        target.classList.toggle(activeClass, isActive);
    };

    const reset = () => {
        dragDepth = 0;
        setActive(false);
    };

    const handleDragEnter = (event: DragEvent) => {
        if (!dragCarriesFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepth += 1;
        setActive(true);
    };

    const handleDragOver = (event: DragEvent) => {
        if (!dragCarriesFiles(event.dataTransfer)) return;
        // Without preventDefault the browser refuses the drop outright.
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        // A dragenter can be missed when the drag starts already inside the
        // target (or is synthesised); keep the affordance truthful regardless.
        if (dragDepth === 0) {
            dragDepth = 1;
        }
        setActive(true);
    };

    const handleDragLeave = (event: DragEvent) => {
        if (!dragCarriesFiles(event.dataTransfer)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
            setActive(false);
        }
    };

    const handleDrop = (event: DragEvent) => {
        // Leave text-selection drops to the browser's native handling.
        if (!dragCarriesFiles(event.dataTransfer)) return;
        event.preventDefault();
        reset();

        const files = event.dataTransfer?.files;
        const file = files?.[0];
        if (!file) {
            options.onError?.('No file found in that drop. Try again.');
            return;
        }

        processFile(file, { ignoredFileCount: files.length - 1 }, { ...options, maxBytes }, () => {
            const readId = (latestReadId += 1);
            return () => disposed || readId !== latestReadId;
        });
    };

    target.addEventListener('dragenter', handleDragEnter);
    target.addEventListener('dragover', handleDragOver);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('drop', handleDrop);

    // Marks the element as accepting file drops. Nothing styles this — it is
    // how the `?` help overlay (common/shortcut-help.tsx) knows whether the page
    // has drop targets to advertise, without a per-tool list to keep in sync.
    target.setAttribute(DROP_ZONE_TARGET_ATTRIBUTE, 'true');

    activeZoneCount += 1;
    installDocumentGuard();

    return () => {
        disposed = true;
        target.removeEventListener('dragenter', handleDragEnter);
        target.removeEventListener('dragover', handleDragOver);
        target.removeEventListener('dragleave', handleDragLeave);
        target.removeEventListener('drop', handleDrop);
        target.removeAttribute(DROP_ZONE_TARGET_ATTRIBUTE);
        reset();
        activeZoneCount = Math.max(0, activeZoneCount - 1);
        releaseDocumentGuard();
    };
}

/**
 * Wire the shared file-loading path onto a hidden file input. The input value
 * is cleared after each selection so choosing the same file again still emits
 * a change event.
 */
export function registerFileInput(target: HTMLInputElement, options: DropZoneOptions): DropZoneCleanup {
    let disposed = false;
    let latestReadId = 0;

    const handleChange = () => {
        const files = target.files;
        const file = files?.[0];
        const ignoredFileCount = files ? files.length - 1 : 0;
        target.value = '';
        if (!file) return;

        processFile(file, { ignoredFileCount }, options, () => {
            const readId = (latestReadId += 1);
            return () => disposed || readId !== latestReadId;
        });
    };

    target.addEventListener('change', handleChange);

    return () => {
        disposed = true;
        latestReadId += 1;
        target.removeEventListener('change', handleChange);
    };
}

/**
 * Read a file as UTF-8 text. Prefers `Blob.text()` and falls back to
 * `FileReader` for environments (and test doubles) that only implement the
 * older API.
 */
export function readFileAsText(file: File): Promise<string> {
    if (typeof file.text === 'function') {
        return file.text();
    }

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('Unreadable file'));
        reader.readAsText(file);
    });
}
