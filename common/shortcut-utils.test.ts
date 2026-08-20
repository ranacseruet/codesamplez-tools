import { registerPrimaryActionShortcut } from './shortcut-utils';

describe('registerPrimaryActionShortcut', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
  });

  it('clicks the target button on Cmd+Enter', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('clicks the target button on Ctrl+Enter', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('invokes a callback target', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores plain Enter without a modifier', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ignores modifier combinations with other keys', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('prevents the default browser behavior of Cmd/Ctrl+Enter', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('stops firing after cleanup', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);
    cleanup();
    cleanup = undefined;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
