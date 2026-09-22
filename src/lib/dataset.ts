/**
 * Readers for the tiered dataset chb writes under DATA_DIR.
 *
 * Every processed file exists once per audience — public/, members/,
 * stewards/ — with the same name and strictly less in each lower tier. A
 * reader picks the one tier its viewer is entitled to (`tierFor(isMember)`)
 * and opens the same relative path it always did; it never merges tiers.
 * stewards/ is unreadable by this process by construction, so nothing here
 * ever needs it. Design: github.com/commonshub/chb/docs/audiences.md.
 */

import * as fs from "fs"
import * as path from "path"
import { DATA_DIR, type Tier, tierDir } from "./data-paths"

export type { Tier }

/** `latest/<tier>/<file>`, `YYYY/<tier>/<file>` or `YYYY/MM/<tier>/<file>`. */
export function tierFile(tier: Tier, file: string, year?: string, month?: string): string {
  return path.join(tierDir(tier, year, month), file)
}

export function readTierJson<T>(tier: Tier, file: string, year?: string, month?: string): T | null {
  const filePath = tierFile(tier, file, year, month)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch (error) {
    console.error(`[dataset] could not parse ${filePath}:`, error)
    return null
  }
}

export function readTierText(tier: Tier, file: string, year?: string, month?: string): string | null {
  const filePath = tierFile(tier, file, year, month)
  if (!fs.existsSync(filePath)) return null
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch (error) {
    console.error(`[dataset] could not read ${filePath}:`, error)
    return null
  }
}

/** Years present in the dataset (directories named YYYY), ascending. */
export function listYears(): string[] {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort()
}

/** Months of a year that have a tier directory, ascending. */
export function listMonths(year: string, tier: Tier = "public"): string[] {
  const yearPath = path.join(DATA_DIR, year)
  if (!fs.existsSync(yearPath)) return []
  return fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name) && fs.existsSync(tierDir(tier, year, d.name)))
    .map((d) => d.name)
    .sort()
}

export interface DatasetEvent {
  id: string
  name: string
  startAt: string
  endAt?: string
  url?: string
  description?: string
  location?: string
  coverImage?: string
  coverImageLocal?: string
  [key: string]: unknown
}

/**
 * Events touching a month. chb rolls events up per year (and in latest/),
 * not per month, so the month view is the year file filtered by start.
 */
export function readEventsForMonth(tier: Tier, year: string, month: string): DatasetEvent[] {
  const prefix = `${year}-${month}`
  const monthly = readTierJson<{ events?: DatasetEvent[] }>(tier, "events.json", year, month)
  if (monthly?.events) return monthly.events
  const yearly = readTierJson<{ events?: DatasetEvent[] }>(tier, "events.json", year)
  return (yearly?.events ?? []).filter((e) => typeof e.startAt === "string" && e.startAt.startsWith(prefix))
}

/** The upcoming events file, as the homepage reads it. */
export function readLatestEvents(tier: Tier = "public"): DatasetEvent[] {
  return readTierJson<{ events?: DatasetEvent[] }>(tier, "events.json")?.events ?? []
}
