/**
 * @jest-environment node
 */
import { afterAll, describe, expect, test } from "@jest/globals"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "aa-"))
process.env.DATA_DIR = root
const write = (rel: string, data: unknown) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), typeof data === "string" ? data : JSON.stringify(data))
}
const fy = (label: string, end: string, status = "filed", extra = {}) => ({
  label, year: end.slice(0, 4), period: { start: label === "2023" ? "2023-07-01" : `${end.slice(0, 4)}-01-01`, end, months: label === "2023" ? 18 : 12 },
  status, currency: "EUR", keyFigures: { totalAssets: 1 }, documents: [], checks: [], ...extra,
})
write("2025/public/annual-accounts.json", { fiscalYears: [fy("2025", "2025-12-31", "filed", {
  documents: [{ kind: "balance-sheet", file: "bs.pdf", path: "2025/public/annual-accounts/bs.pdf", sha256: "x", bytes: 1 }],
  checks: [{ level: "warning", code: "balancing-appropriation", message: "a balancing entry" }],
})] })
write("2025/public/annual-accounts/bs.pdf", "%PDF-1.4")
write("2024/public/annual-accounts.json", { fiscalYears: [fy("2023", "2024-12-31"), fy("2024-draft", "2024-12-31", "draft")] })
write("latest/public/annual-accounts.json", { fiscalYears: [fy("2023", "2024-12-31"), fy("2025", "2025-12-31"), fy("2026", "2026-12-31", "draft")] })

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aa = require("@/lib/annual-accounts") as typeof import("@/lib/annual-accounts")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const od = require("@/lib/opendata") as typeof import("@/lib/opendata")

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe("annual accounts", () => {
  test("filed fiscal years only, under the year their period ends", () => {
    expect(aa.readAnnualAccounts("2024").map((f) => f.label)).toEqual(["2023"])
    expect(aa.readAnnualAccounts("2023")).toEqual([])
    expect(aa.readAllAnnualAccounts().map((f) => f.label)).toEqual(["2025", "2023"])
  })

  test("documents are served by the open-data API, nothing else under the folder", () => {
    expect(aa.documentHref({ path: "2025/public/annual-accounts/bs.pdf" })).toBe("/opendata/2025/annual-accounts/bs.pdf")
    expect(od.isOpendataFile("annual-accounts.json")).toBe(true)
    expect(od.isOpendataFile("annual-accounts/bs.pdf")).toBe(true)
    expect(od.isOpendataFile("annual-accounts/trial_balance.csv")).toBe(false)
    expect(od.isOpendataFile("annual-accounts/../stewards/x.pdf")).toBe(false)
    const target = od.resolveOpendata(["2025", "annual-accounts", "bs.pdf"])
    expect(target && target.kind === "file" && target.fsPath).toBe(path.join(root, "2025/public/annual-accounts/bs.pdf"))
  })
})
