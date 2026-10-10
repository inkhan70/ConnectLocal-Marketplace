/**
 * Storage Utilities for Subscription Plans
 * Handles storage limit calculations and conversions
 */

/**
 * Convert GB to bytes
 */
export function gbToBytes(gb: number): number {
  return gb * 1024 * 1024 * 1024;
}

/**
 * Convert bytes to GB
 */
export function bytesToGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

/**
 * Convert bytes to MB
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calculate storage usage percentage
 */
export function getStoragePercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Check if user has exceeded storage limit
 */
export function isStorageLimitExceeded(used: number, limit: number): boolean {
  return used > limit;
}

/**
 * Check if user is approaching storage limit (>80%)
 */
export function isStorageLimitApproaching(used: number, limit: number, threshold = 0.8): boolean {
  return (used / limit) > threshold;
}

/**
 * Get remaining storage in bytes
 */
export function getRemainingStorage(used: number, limit: number): number {
  return Math.max(0, limit - used);
}

/**
 * Format storage info for display
 */
export interface StorageInfo {
  used: string;
  limit: string;
  remaining: string;
  percentage: number;
  isExceeded: boolean;
  isApproaching: boolean;
}

export function formatStorageInfo(usedBytes: number, limitBytes: number): StorageInfo {
  return {
    used: formatBytes(usedBytes),
    limit: formatBytes(limitBytes),
    remaining: formatBytes(getRemainingStorage(usedBytes, limitBytes)),
    percentage: getStoragePercentage(usedBytes, limitBytes),
    isExceeded: isStorageLimitExceeded(usedBytes, limitBytes),
    isApproaching: isStorageLimitApproaching(usedBytes, limitBytes),
  };
}
