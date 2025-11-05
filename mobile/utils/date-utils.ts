/**
 * Date Utility Functions
 */

import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format a date string to a readable format
 */
export const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Format time only
 */
export const formatTime = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'h:mm a');
  } catch (error) {
    return 'Invalid time';
  }
};

/**
 * Format date as relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (error) {
    return 'Unknown';
  }
};

/**
 * Get current ISO timestamp
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};
