import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { memberIdForEmail, nameTokenHash, nameTokens } from "@/lib/membership"
import { MONTHLY_PRICE_IDS, memberEntry, nameCandidate, planFor, planOf } from "@/lib/member-plan"
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

describe("a membership matched by name", () => {
  const salt = process.env.EMAIL_HASH_SALT
  beforeAll(() => {
    process.env.EMAIL_HASH_SALT = "test-salt"
  })
  afterAll(() => {
    process.env.EMAIL_HASH_SALT = salt
  })
  const named = (name: string, over: Partial<Member> = {}) =>
    member({ firstName: name.split(" ")[0], accounts: { emailHash: memberIdForEmail(`${name}@x.example`)!, nameTokens: nameTokens(name).map((t) => nameTokenHash(t)!).sort() }, ...over })

  test("words of a name ignore case, accents, punctuation and order", () => {
    expect(nameTokens("Dean Miriam")).toEqual(["dean", "miriam"])
    expect(nameTokens("  MIRIAM  dean ")).toEqual(["dean", "miriam"])
    expect(nameTokens("Clément Lefèvre-Dupont")).toEqual(["clement", "dupont", "lefevre"])
    expect(nameTokens("J. Doe")).toEqual(["doe"])
  })

  test("a Discord name matches the one membership whose name has all its words", () => {
    const miriam = named("Dean Miriam", { amount: { value: 10, decimals: 2, currency: "EUR" } })
    const members = [miriam, named("Tom Smith"), named("Tom Jones")]
    expect(nameCandidate("Miriam", members, new Set())).toBe(miriam)
    expect(nameCandidate("miriam DEAN", members, new Set())).toBe(miriam)
    expect(nameCandidate("Tom", members, new Set())).toBeNull()
    expect(nameCandidate("Tom Jones", members, new Set())?.firstName).toBe("Tom")
    expect(nameCandidate("Bob", members, new Set())).toBeNull()
  })

  test("the same words exactly win over a longer name", () => {
    const ann = named("Ann Lee")
    expect(nameCandidate("Ann Lee", [ann, named("Ann Lee Smith")], new Set())).toBe(ann)
  })

  test("never a membership already linked to a Discord account, a lapsed one, or one without fingerprints", () => {
    const miriam = named("Dean Miriam")
    expect(nameCandidate("Miriam", [miriam], new Set([miriam.accounts.emailHash]))).toBeNull()
    expect(nameCandidate("Miriam", [named("Dean Miriam", { accounts: { ...miriam.accounts, discord: "123456" } })], new Set())).toBeNull()
    expect(nameCandidate("Miriam", [named("Dean Miriam", { status: "lapsed" as Member["status"] })], new Set())).toBeNull()
    expect(nameCandidate("Miriam", [member({ firstName: "Miriam" })], new Set())).toBeNull()
  })
})
