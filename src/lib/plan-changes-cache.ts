import * as fs from "fs"

import { ensureDirFor, runtimePath } from "./runtime-paths"

/**
 * Plan changes members made on the dashboard, by membership id, until chb's
 * members list shows them (it's pulled hourly; a cancellation shows once chb
 * publishes cancelsOn). A cache of what Stripe already holds: kept under
 * RUNTIME_DIR, a restart forgets it.
 */
export type PlanChange = { amount?: number; endsOn?: string | null; at: string }
const CHANGES_FILE = runtimePath("plan-changes.json")
let changes: Record<string, PlanChange> | null = null

export function readChanges(): Record<string, PlanChange> {
  if (!changes) {
    try {
      changes = JSON.parse(fs.readFileSync(CHANGES_FILE, "utf-8")) as Record<string, PlanChange>
    } catch {
      changes = {}
    }
  }
  return changes
}

export function saveChange(id: string, change: Omit<PlanChange, "at">) {
  const all = readChanges()
  all[id] = { ...all[id], ...change, at: new Date().toISOString() }
  if (!ensureDirFor(CHANGES_FILE)) return
  try {
    fs.writeFileSync(CHANGES_FILE, JSON.stringify(all), "utf-8")
  } catch (error) {
    console.error("[membership] Cannot save plan change:", error)
  }
}
