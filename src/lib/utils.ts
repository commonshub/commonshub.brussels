import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a URL for display by removing the protocol and www prefix,
 * and truncating to a specified length
 *
 * @param url - The URL to format
 * @param length - Maximum length before truncation (default: 52)
 * @returns Formatted URL string
 *
 * @example
 * displayUrl("https://www.example.com/very/long/path") // "example.com/very/long/path"
 * displayUrl("https://example.com/very/long/path/that/exceeds/the/limit", 20) // "example.com/very/lon..."
 */
export function displayUrl(url: string, length: number = 52): string {
  // Remove https:// or http:// prefix and optional www.
  let displayUrl = url.replace(/^https?:\/\/(www\.)?/, '');

  // Truncate if needed
  if (displayUrl.length > length) {
    return displayUrl.substring(0, length) + '...';
  }

  return displayUrl;
}
