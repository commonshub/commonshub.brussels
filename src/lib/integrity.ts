/**
 * Integrity manifests, as chb writes them (docs/website.md §4 in
 * github.com/commonshub/chb).
 *
 * `YYYY/MM/hashes.json` describes the raw archives of a completed
 * month without revealing them: one entry per provider with counts, size and
 * a sha256 over the canonicalised JSON (sorted keys, fetch timestamps
 * dropped), plus the month hash. `latest/hashes.json` lists every
 * month's hash. Two chb instances holding the same raw data produce the same
 * hashes, so anyone mirroring the sources can check this site's dataset
 * against their own with `chb integrity YYYY/MM --json`.
 */

import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"

// Since chb 3.12.1 the manifests sit once at the month root, outside the
// audience tiers: a hash is the same for everyone, so there is no per-tier
// copy (chb removes the older YYYY/MM/<tier>/integrity.json ones).
const MANIFEST = "hashes.json"

function readJson<T>(file: string): T | null {
  try {
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as T) : null
  } catch (error) {
    console.error(`[integrity] could not read ${file}:`, error)
    return null
  }
}

export interface ProviderIntegrity {
  provider: string
  summary: string
  stats?: Record<string, number>
  files: number
  bytes: number
  hash: string
}

export interface MonthIntegrity {
  month: string
  generatedAt: string
  algorithm: string
  providers: number
  files: number
  bytes: number
  hash: string
  entries: ProviderIntegrity[]
}

export interface IntegrityIndexEntry {
  month: string
  providers: number
  files: number
  bytes: number
  hash: string
}

export interface IntegrityIndex {
  generatedAt: string
  algorithm: string
  months: IntegrityIndexEntry[]
}

const MONTH_RE = /^(\d{4})-(\d{2})$/

/** Every month's hash, newest first. */
export function readIntegrityIndex(): IntegrityIndex | null {
  const index = readJson<IntegrityIndex>(path.join(DATA_DIR, "latest", MANIFEST))
  if (!index) return null
  const months = (index.months ?? []).filter((m) => MONTH_RE.test(m.month)).sort((a, b) => b.month.localeCompare(a.month))
  return { ...index, months }
}

/** The manifest of one completed month, or null when chb has not written one. */
export function readMonthIntegrity(year: string, month: string): MonthIntegrity | null {
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return null
  return readJson<MonthIntegrity>(path.join(DATA_DIR, year, month, MANIFEST))
}

/** The newest month with a manifest: what /status shows. */
export function latestIntegrity(): (IntegrityIndexEntry & { generatedAt: string; algorithm: string }) | null {
  const index = readIntegrityIndex()
  const newest = index?.months[0]
  return index && newest ? { ...newest, generatedAt: index.generatedAt, algorithm: index.algorithm } : null
}

export const shortHash = (hash: string, length = 8): string => `${hash.slice(0, length)}…`

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("en-US")} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
