import { describe, expect, test } from "@jest/globals"
import { isServableDataPath } from "@/lib/served-paths"

describe("what the image proxy may serve from the dataset", () => {
  test("event covers and Discord photos, images only", () => {
    expect(isServableDataPath("2026/09/public/events/images/evt-EP97.png")).toBe(true)
    expect(isServableDataPath("latest/public/events/images/evt.jpg")).toBe(true)
    expect(isServableDataPath("2026/public/events/images/evt.webp")).toBe(true)
    expect(isServableDataPath("2026/08/providers/discord/images/1533075350333034648.jpg")).toBe(true)
  })

  test("never the members or stewards tiers, raw archives, or non-images", () => {
    expect(isServableDataPath("2026/09/members/events/images/evt.png")).toBe(false)
    expect(isServableDataPath("2026/09/stewards/transactions.json")).toBe(false)
    expect(isServableDataPath("2026/09/generated/private/enrichment.json")).toBe(false)
    expect(isServableDataPath("2026/09/public/transactions.json")).toBe(false)
    expect(isServableDataPath("2026/08/providers/odoo/commonshub/private/bills.json")).toBe(false)
    expect(isServableDataPath("2026/08/providers/discord/messages.json")).toBe(false)
    expect(isServableDataPath("latest/members/profiles/x.png")).toBe(false)
  })

  test("never a path that climbs or is malformed", () => {
    expect(isServableDataPath("../etc/passwd.png")).toBe(false)
    expect(isServableDataPath("2026/09/public/../stewards/x.png")).toBe(false)
    expect(isServableDataPath("2026/09/public//x.png")).toBe(false)
    expect(isServableDataPath("")).toBe(false)
  })
})
