import { NotificationManager } from './notification-manager.js';

describe('NotificationManager', () => {
  let notificationElement;

  beforeEach(() => {
    // Set up DOM elements
    document.body.innerHTML = `
      <div id="notification" class="c-notification"></div>
    `;
    notificationElement = document.getElementById('notification');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('show() displays notification with message', () => {
    const testMessage = 'Test notification';
    NotificationManager.show(testMessage);
    
    expect(notificationElement.textContent).toBe(testMessage);
    expect(notificationElement.classList.contains('show')).toBe(true);
  });

  test('show() hides notification after duration', () => {
    jest.useFakeTimers();
    NotificationManager.show('Test', 1000);
    
    // Should be visible initially
    expect(notificationElement.classList.contains('show')).toBe(true);
    
    // Advance timers and check it's hidden
    jest.advanceTimersByTime(1000);
    expect(notificationElement.classList.contains('show')).toBe(false);
    
    jest.useRealTimers();
  });

  test('show() applies type class when specified', () => {
    NotificationManager.show('Error', 2000, { type: 'error' });
    
    expect(notificationElement.classList.contains('notification-error')).toBe(true);
  });

  test('show() resets previous type classes', () => {
    // First show with error type
    NotificationManager.show('Error', 2000, { type: 'error' });
    expect(notificationElement.classList.contains('notification-error')).toBe(true);
    
    // Then show with success type
    NotificationManager.show('Success', 2000, { type: 'success' });
    expect(notificationElement.classList.contains('notification-error')).toBe(false);
    expect(notificationElement.classList.contains('notification-success')).toBe(true);
  });

  test('show() handles missing notification element gracefully', () => {
    document.body.innerHTML = ''; // Remove notification element
    expect(() => {
      NotificationManager.show('Test');
    }).not.toThrow();
  });
});
