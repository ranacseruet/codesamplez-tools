import { jest } from '@jest/globals';
import { OPTIONS_HEIGHT_VAR, trackOptionsHeight } from './sticky-offset';

function makeStrip(height) {
    const strip = document.createElement('div');
    strip.getBoundingClientRect = () => ({ height });
    return strip;
}

describe('trackOptionsHeight', () => {
    let target;

    beforeEach(() => {
        target = document.createElement('div');
        document.body.appendChild(target);
    });

    afterEach(() => {
        target.remove();
        delete globalThis.ResizeObserver;
        jest.restoreAllMocks();
    });

    it('writes the measured strip height into the custom property immediately', () => {
        trackOptionsHeight(makeStrip(80.48), target);

        expect(target.style.getPropertyValue(OPTIONS_HEIGHT_VAR)).toBe('80px');
    });

    it('leaves the CSS fallback in place when the strip measures zero', () => {
        trackOptionsHeight(makeStrip(0), target);

        expect(target.style.getPropertyValue(OPTIONS_HEIGHT_VAR)).toBe('');
    });

    it('returns a no-op disposer when either element is missing', () => {
        expect(() => trackOptionsHeight(null, target)()).not.toThrow();
        expect(() => trackOptionsHeight(makeStrip(80), null)()).not.toThrow();
    });

    it('re-measures through a ResizeObserver and disconnects on cleanup', () => {
        const disconnect = jest.fn();
        let notify = null;
        const observe = jest.fn();
        globalThis.ResizeObserver = class {
            constructor(callback) {
                notify = callback;
            }

            observe(...args) {
                observe(...args);
            }

            disconnect() {
                disconnect();
            }
        };

        const strip = makeStrip(80);
        const stop = trackOptionsHeight(strip, target);

        expect(observe).toHaveBeenCalledWith(strip);
        expect(target.style.getPropertyValue(OPTIONS_HEIGHT_VAR)).toBe('80px');

        strip.getBoundingClientRect = () => ({ height: 264 });
        notify();
        expect(target.style.getPropertyValue(OPTIONS_HEIGHT_VAR)).toBe('264px');

        stop();
        expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it('falls back to a window resize listener when ResizeObserver is unavailable', () => {
        const addSpy = jest.spyOn(window, 'addEventListener');
        const removeSpy = jest.spyOn(window, 'removeEventListener');

        const strip = makeStrip(80);
        const stop = trackOptionsHeight(strip, target);

        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

        strip.getBoundingClientRect = () => ({ height: 264 });
        window.dispatchEvent(new Event('resize'));
        expect(target.style.getPropertyValue(OPTIONS_HEIGHT_VAR)).toBe('264px');

        stop();
        expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

        strip.getBoundingClientRect = () => ({ height: 500 });
        window.dispatchEvent(new Event('resize'));
        expect(target.style.getPropertyValue(OPTIONS_HEIGHT_VAR)).toBe('264px');
    });
});
