/**
 * Simple internal logging utility for action logging.
 * Logs messages with timestamps to the console.
 */

export function logAction(action: string, details?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ACTION: ${action}`, details || '');
}
