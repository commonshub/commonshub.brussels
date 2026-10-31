import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { memberIdForEmail } from "@/lib/membership"
import { MONTHLY_PRICE_IDS, memberEntry, planFor, planOf } from "@/lib/member-plan"
import type { Member } from "@/types/members"

const member = (over: Partial<Member>): Member => ({
  id: "sub_1PaaaaaaaaaaaaA",
  source: "stripe",
  accounts: { emailHash: "x".repeat(64) },
  firstName: "Ann",
  plan: "monthly",
  amount: { value: 15, decimals: 2, currency: "EUR" },
  interval: "month",
  status: "active",
  currentPeriodStart: "2026-10-01T00:00:00Z",
  currentPeriodEnd: "2026-11-01T00:00:00Z",
  latestPayment: null,
  createdAt: "2025-01-01T00:00:00Z",
  ...over,
})

describe("a member's plan on the dashboard", () => {
  const salt = process.env.EMAIL_HASH_SALT
  afterAll(() => {
    process.env.EMAIL_HASH_SALT = salt
  })

  test("found from the session's email hash in members.json, never from an id the browser sends", () => {
    process.env.EMAIL_HASH_SALT = "test-salt"
    const hash = memberIdForEmail("ann@example.org")!
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-"))
    fs.writeFileSync(path.join(dir, "members.json"), JSON.stringify({ members: [member({ accounts: { emailHash: hash } }), member({ amount: { value: 20, decimals: 2, currency: "EUR" } })] }))
    expect(planFor({ email: "Ann@Example.org " }, dir)).toEqual({ amount: 15, interval: "month", source: "stripe", status: "active", renewsOn: "2026-11-01", organisation: false, canChange: true })
    expect(planFor({ email: "bob@example.org" }, dir)).toBeNull()
    expect(planFor({}, dir)).toBeNull()
  })

  test("found through an address the member confirmed, when they pay with another one than their Discord email", () => {
    process.env.EMAIL_HASH_SALT = "test-salt"
    const paying = memberIdForEmail("miriam@work.example")!
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-"))
    fs.writeFileSync(path.join(dir, "members.json"), JSON.stringify({ members: [member({ accounts: { emailHash: paying }, amount: { value: 10, decimals: 2, currency: "EUR" } })] }))
    expect(planFor({ email: "miriam@discord.example" }, dir)).toBeNull()
    expect(planFor({ email: "miriam@discord.example" }, dir, [paying])?.amount).toBe(10)
  })

  test("only a monthly card plan of an individual changes here; yearly ones at renewal", () => {
    expect(planOf(member({})).canChange).toBe(true)
    expect(planOf(member({ interval: "year", plan: "yearly", amount: { value: 100, decimals: 2, currency: "EUR" } })).canChange).toBe(false)
    expect(planOf(member({ source: "odoo", interval: "year" })).canChange).toBe(false)
    expect(planOf(member({ isOrganization: true })).canChange).toBe(false)
  })

  test("the active entry wins over a lapsed one", () => {
    const h = "y".repeat(64)
    const lapsed = member({ accounts: { emailHash: h }, status: "lapsed", amount: { value: 10, decimals: 2, currency: "EUR" } })
    const active = member({ accounts: { emailHash: h }, amount: { value: 20, decimals: 2, currency: "EUR" } })
    expect(memberEntry(h, [lapsed, active])?.amount.value).toBe(20)
  })

  test("a price for each monthly amount", () => {
    expect(Object.keys(MONTHLY_PRICE_IDS)).toEqual(["10", "15", "20"])
  })
})
