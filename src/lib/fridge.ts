/**
 * What is in the fridge: the drinks of the latest delivery, read from the
 * vendor bills chb publishes (YYYY/MM/public/bills.json). One bill line per
 * crate, e.g. "[4504] Fritz Limo Citron (Casier de 24 x 33cl)" × 3; deposit
 * lines ("Vidanges"), returns (negative quantities) and anything that is
 * not a crate (milk, sugar) are left out.
 *
 * Pure parsing here; the loader at the bottom reads the dataset.
 */

import * as fs from "fs"
import * as path from "path"
import settings from "@/settings/settings.json"
import { DATA_DIR } from "./data-paths"
import { listMonths, listYears } from "./dataset"

export interface FridgeConfig {
  vendor: string
  crate: string
  roundTo: number
  minimum: number
}

export const FRIDGE: FridgeConfig = (settings as unknown as { fridge: FridgeConfig }).fridge

export interface Drink {
  /** Stable within a delivery: the product code, or the name. */
  id: string
  name: string
  /** "33cl", "75cl", "1L". */
  size: string
  /** Bottles per crate. */
  perCrate: number
  /** Bottles delivered. */
  bottles: number
  /** What one bottle cost us, VAT included, deposit excluded. */
  costPerBottle: number
  /** What a crate cost us. */
  crateCost: number
  /** Alcohol by volume, when the name says (5,8% → 5.8). */
  abv?: number
  /** The amount suggested for one bottle. */
  suggested: number
}

export interface Delivery {
  number: string
  date: string
  drinks: Drink[]
}

interface BillLine {
  description?: string
  quantity?: number
  totalAmount?: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function suggestedPrice(cost: number, config: Pick<FridgeConfig, "roundTo" | "minimum"> = FRIDGE): number {
  const step = config.roundTo || 0.5
  return Math.max(config.minimum, Math.ceil(round2(cost) / step - 1e-9) * step)
}

/** "75cl" → "75cl", "1 l" → "1L", "33 CL" → "33cl". */
function normaliseSize(raw: string): string {
  const s = raw.replace(/\s+/g, "").replace(",", ".").toLowerCase()
  return s.endsWith("cl") ? s : s.replace(/l$/, "L")
}

/** The drinks on one delivery bill, merged by product, A to Z. */
export function drinksFromLines(lines: BillLine[], config: FridgeConfig = FRIDGE): Drink[] {
  const crate = new RegExp(config.crate, "i")
  const byId = new Map<string, Drink>()
  for (const line of lines) {
    const qty = line.quantity ?? 0
    const total = line.totalAmount ?? 0
    if (qty <= 0 || total <= 0) continue
    const text = (line.description ?? "").split("\n").map((s) => s.trim()).filter(Boolean)
    const title = text[text.length - 1] ?? ""
    const match = title.match(crate)
    if (!match) continue
    const code = (line.description ?? "").match(/^\[(\w+)\]/)?.[1]
    const name = title.slice(0, match.index).trim().replace(/\s+-\s+drinkdrink!?$/i, "").trim()
    const perCrate = Number(match[1])
    if (!name || !perCrate) continue
    const id = code ?? name.toLowerCase()
    const abvMatch = name.match(/(\d+(?:[.,]\d+)?)\s*%/)
    const existing = byId.get(id)
    const bottles = (existing?.bottles ?? 0) + qty * perCrate
    const spent = (existing ? existing.costPerBottle * existing.bottles : 0) + total
    const costPerBottle = round2(spent / bottles)
    byId.set(id, {
      id,
      name,
      size: normaliseSize(match[2]),
      perCrate,
      bottles,
      costPerBottle,
      crateCost: round2(costPerBottle * perCrate),
      ...(abvMatch ? { abv: Number(abvMatch[1].replace(",", ".")) } : {}),
      suggested: suggestedPrice(costPerBottle, config),
    })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

interface PublicBill {
  number: string
  type?: string
  date: string
  vendor?: { type?: string; name?: string }
  lines?: BillLine[]
}

/** The latest delivery from the fridge vendor, newest month first; null when none is published. */
export function loadLatestDelivery(config: FridgeConfig = FRIDGE, dataDir: string = DATA_DIR): Delivery | null {
  const vendor = new RegExp(config.vendor, "i")
  for (const year of listYears().reverse()) {
    for (const month of listMonths(year, "public").reverse()) {
      const file = path.join(dataDir, year, month, "public", "bills.json")
      if (!fs.existsSync(file)) continue
      let bills: PublicBill[] = []
      try {
        bills = (JSON.parse(fs.readFileSync(file, "utf-8")) as { bills?: PublicBill[] }).bills ?? []
      } catch {
        continue
      }
      const latest = bills
        .filter((b) => b.type !== "credit_note" && vendor.test(b.vendor?.name ?? ""))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((b) => ({ number: b.number, date: b.date, drinks: drinksFromLines(b.lines ?? [], config) }))
        .find((d) => d.drinks.length > 0)
      if (latest) return latest
    }
  }
  return null
}

/** "2× Zinnebir, 1× Fritz Limo Citron", for the payment description and transfer message. */
export function orderSummary(items: Array<{ drink: Drink; quantity: number }>): string {
  return items.filter((i) => i.quantity > 0).map((i) => `${i.quantity}× ${i.drink.name}`).join(", ")
}
