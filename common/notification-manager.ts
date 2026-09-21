/**
 * Shared Notification Manager for tools
 * Provides consistent notification behavior across all tools
 */
interface NotificationOptions {
  type?: NotificationType;
}

type NotificationType = 'error' | 'success' | 'warning' | 'default';

export class NotificationManager {
  /** Timer for the currently displayed notification, so a new show() can cancel the pending hide. */
  private static hideTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Show a notification message
   * @param {string} message - The message to display
   * @param {number} [duration=2000] - Duration in milliseconds (default: 2000)
   * @param {object} [options] - Additional options
   * @param {NotificationType} [options.type] - Notification type ('error' | 'success' | 'warning' | 'default')
   */
  static show(message: string, duration = 2000, options: NotificationOptions = {}): void {
    const notification = document.getElementById('notification');
    if (!notification) {
      console.warn('Notification element not found');
      return;
    }
    
    // Cancel the pending hide from a previous notification so it can't cut this one short
    if (NotificationManager.hideTimer !== null) {
      clearTimeout(NotificationManager.hideTimer);
      NotificationManager.hideTimer = null;
    }

    // Clear previous notification state
    notification.className = 'c-notification';
    notification.textContent = message;
    
    // Apply notification type if specified
    if (options.type) {
      notification.classList.add(`notification-${options.type}`);
    }
    
    // Show notification
    notification.classList.add('show');
    
    // Auto-hide after duration
    NotificationManager.hideTimer = setTimeout(() => {
      notification.classList.remove('show');
      NotificationManager.hideTimer = null;
    }, duration);
  }
}
