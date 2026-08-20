/**
 * Test helpers for the drag-and-drop file loading wired up by
 * `common/drop-zone.ts`. jsdom implements neither `DragEvent` nor
 * `DataTransfer`, so drops have to be synthesised: a cancelable event carrying
 * a stand-in shaped like the members the module actually reads (`types` and
 * `files`).
 */

interface DropZoneTestTransfer {
    types: string[];
    files: File[];
    dropEffect: string;
}

/** Dispatch a drag-family event carrying `files` at `target`. */
export function fireFileDragEvent(
    target: EventTarget,
    type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
    files: File[] = []
): Event {
    const dataTransfer: DropZoneTestTransfer = { types: ['Files'], files, dropEffect: '' };
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(event);
    return event;
}

/** Drop a single text file with the given contents onto `target`. */
export function fireFileDrop(target: EventTarget, contents: string, fileName = 'dropped.txt'): Event {
    return fireFileDragEvent(target, 'drop', [new File([contents], fileName)]);
}

/**
 * Wait for the drop pipeline to settle. The module reads the file through a
 * promise (`Blob.text()`), which jsdom resolves over more than one turn.
 */
export async function flushFileDrop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}
