/**
 * Shared Notification Manager for tools
 * Provides consistent notification behavior across all tools
 */
export class NotificationManager {
  /**
   * Show a notification message
   * @param {string} message - The message to display
   * @param {number} [duration=2000] - Duration in milliseconds (default: 2000)
   * @param {object} [options] - Additional options
   * @param {string} [options.type] - Notification type ('error', 'success', etc.)
   */
  static show(message, duration = 2000, options = {}) {
    const notification = document.getElementById('notification');
    if (!notification) {
      console.warn('Notification element not found');
      return;
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
    setTimeout(() => {
      notification.classList.remove('show');
    }, duration);
  }
}
