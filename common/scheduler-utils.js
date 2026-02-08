/**
 * Utility for scheduling tasks to allow the main thread to yield.
 * This helps in preventing "Interaction to Next Paint" (INP) issues by allowing
 * the browser to render UI updates (like spinners or disabled buttons) before
 * blocking on heavy synchronous computations.
 */

/**
 * Schedules a callback to run after a short delay, returning a Promise.
 * This allows using `await scheduleTask()` to yield control to the browser/event loop.
 * 
 * @param {number} delayMs - The delay in milliseconds (default 20ms).
 * @returns {Promise<void>}
 */
export function scheduleTask(delayMs = 20) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Schedules a callback to run in the next animation frame.
 * @returns {Promise<void>}
 */
export function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}
