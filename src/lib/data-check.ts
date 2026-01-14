/**
 * Utilities to check if data directory has been populated
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

/**
 * Check if data directory exists and has any year folders
 */
export function hasAnyData(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return false;
    }

    const entries = fs.readdirSync(DATA_DIR);

    // Check if there are any year folders (numeric folders like 2024, 2025)
    const hasYearFolders = entries.some((entry) => {
      const fullPath = path.join(DATA_DIR, entry);
      return fs.statSync(fullPath).isDirectory() && /^\d{4}$/.test(entry);
    });

    // Also check for "latest" folder
    const hasLatest = entries.includes("latest");

    return hasYearFolders || hasLatest;
  } catch (error) {
    console.error("Error checking data directory:", error);
    return false;
  }
}

/**
 * Check if a specific year/month has data
 */
export function hasMonthData(year: string, month: string): boolean {
  try {
    const monthPath = path.join(DATA_DIR, year, month);
    return fs.existsSync(monthPath);
  } catch (error) {
    return false;
  }
}

/**
 * Get available years with data
 */
export function getAvailableYears(): string[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }

    const entries = fs.readdirSync(DATA_DIR);

    return entries
      .filter((entry) => {
        const fullPath = path.join(DATA_DIR, entry);
        return fs.statSync(fullPath).isDirectory() && /^\d{4}$/.test(entry);
      })
      .sort();
  } catch (error) {
    console.error("Error getting available years:", error);
    return [];
  }
}

/**
 * Get available months for a specific year
 */
export function getAvailableMonths(year: string): string[] {
  try {
    const yearPath = path.join(DATA_DIR, year);
    if (!fs.existsSync(yearPath)) {
      return [];
    }

    const entries = fs.readdirSync(yearPath);

    return entries
      .filter((entry) => {
        const fullPath = path.join(yearPath, entry);
        return fs.statSync(fullPath).isDirectory() && /^\d{2}$/.test(entry);
      })
      .sort();
  } catch (error) {
    return [];
  }
}

/**
 * Get the most recent month with data
 */
export function getMostRecentMonth(): { year: string; month: string } | null {
  const years = getAvailableYears();
  if (years.length === 0) {
    return null;
  }

  // Start from most recent year
  for (let i = years.length - 1; i >= 0; i--) {
    const year = years[i];
    const months = getAvailableMonths(year);

    if (months.length > 0) {
      return {
        year,
        month: months[months.length - 1],
      };
    }
  }

  return null;
}
