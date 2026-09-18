/**
 * Schedules a callback to run after a short delay, returning a Promise.
 * This allows using `await scheduleTask()` to yield control to the browser/event loop.
 */
export function scheduleTask(delayMs = 20): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Schedules a callback to run in the next animation frame.
 */
export function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
