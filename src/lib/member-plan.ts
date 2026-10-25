/**
 * The signed-in member's membership plan, for the dashboard (/), and
 * changing what an individual pays each month (€10, €15 or €20).
 *
 * The member is found the way /api/members/me finds them: from the session
 * (their Discord account, else the salted hash of their email), never from an
 * id the browser sends. Their plan is their entry in the members tier's
 * members.json, which carries no email address. A monthly card subscription
 * is changed on Stripe: the new amount applies from the next payment.
 * Yearly plans (and Odoo or bank-transfer ones) change at renewal.
 */

import * as fs from "fs"
import * as path from "path"
import Stripe from "stripe"

import { tierDir } from "./data-paths"
import { discordIdentifier, emailIdentifier, memberIdForEmail, resolveMemberId } from "./membership"
import { MONTHLY_PRICES, type MonthlyPrice } from "./membership-application"
import settings from "@/settings/settings.json"
import type { Member, MembersFile } from "@/types/members"

/** The Stripe price behind each monthly amount (the payment links' prices). */
export const MONTHLY_PRICE_IDS: Record<MonthlyPrice, string> = {
  10: "price_1PjHIHFAhaWeDyowVGxd77G6",
  15: "price_1SYRUmFAhaWeDyowA3pNzlGE",
  20: "price_1SYRV2FAhaWeDyowYwiPYXDX",
}

export interface MemberPlan {
  amount: number
  interval: "month" | "year"
  source: Member["source"]
  status: Member["status"]
  /** YYYY-MM-DD, when the current period ends (renews). */
  renewsOn: string | null
  organisation: boolean
  /** Whether they can change their monthly amount here: a monthly card subscription. */
  canChange: boolean
}

/** The members tier's latest members.json, or null. */
function readMembers(dir = tierDir("members")): Member[] | null {
  try {
    return (JSON.parse(fs.readFileSync(path.join(dir, "members.json"), "utf-8")) as MembersFile).members ?? []
  } catch {
    return null
  }
}

/** The membership id of the session's user, or null. */
export function memberIdOf(user: { discordId?: string | null; email?: string | null }): string | null {
  const emailHash = memberIdForEmail(user.email)
  return resolveMemberId([user.discordId ? discordIdentifier(user.discordId) : null, emailHash ? emailIdentifier(emailHash) : null])
}

/** Their entry in members.json: the active one if there are several. */
export function memberEntry(memberId: string, members: Member[]): Member | null {
  const mine = members.filter((m) => m.accounts?.emailHash === memberId)
  return mine.find((m) => m.status === "active" || m.status === "trialing") ?? mine.find((m) => m.status === "grace" || m.status === "past_due") ?? mine[0] ?? null
}

export function planOf(m: Member): MemberPlan {
  const monthly = m.interval === "month"
  return {
    amount: m.amount.value,
    interval: m.interval,
    source: m.source,
    status: m.status,
    renewsOn: m.currentPeriodEnd ? m.currentPeriodEnd.slice(0, 10) : null,
    organisation: !!(m.isOrganization || m.organizationName),
    canChange: monthly && m.source === "stripe" && !(m.isOrganization || m.organizationName),
  }
}

/** The session user's plan, or null when we can't find them among the members. */
export function planFor(user: { discordId?: string | null; email?: string | null }, dir?: string): MemberPlan | null {
  const id = memberIdOf(user)
  const members = id ? readMembers(dir) : null
  const entry = id && members ? memberEntry(id, members) : null
  return entry ? planOf(entry) : null
}

/**
 * Change a member's monthly amount. Their Stripe subscription is found from
 * the (truncated) id in members.json, among the membership's monthly
 * subscriptions; the price is swapped without proration, so the new amount
 * is what they pay from their next payment on.
 */
export async function changeMonthlyAmount(user: { discordId?: string | null; email?: string | null }, amount: number): Promise<{ ok: true; amount: MonthlyPrice; from: number } | { ok: false; error: string; status: number }> {
  const target = MONTHLY_PRICES.find((p) => p.amount === amount)?.amount
  if (!target) return { ok: false, error: "Choose €10, €15 or €20 a month", status: 400 }
  const id = memberIdOf(user)
  const members = id ? readMembers() : null
  const entry = id && members ? memberEntry(id, members) : null
  if (!entry) return { ok: false, error: "We can't find your membership. Write to hello@commonshub.brussels and we'll sort it out.", status: 404 }
  if (!planOf(entry).canChange) return { ok: false, error: "Your plan can only be changed when it renews.", status: 409 }
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return { ok: false, error: "Card payments are not available right now, please try again later.", status: 503 }
  const stripe = new Stripe(key)
  const sub = await findSubscription(stripe, entry.id)
  if (!sub) return { ok: false, error: "We can't find your card subscription. Write to hello@commonshub.brussels and we'll sort it out.", status: 404 }
  const item = sub.items.data.find((i) => i.price.product === settings.membership.stripe.productId) ?? sub.items.data[0]
  const from = (item.price.unit_amount ?? 0) / 100
  if (item.price.id !== MONTHLY_PRICE_IDS[target]) {
    await stripe.subscriptions.update(sub.id, { items: [{ id: item.id, price: MONTHLY_PRICE_IDS[target] }], proration_behavior: "none", metadata: { ...sub.metadata, changedFrom: String(from), changedVia: "website" } })
  }
  return { ok: true, amount: target, from }
}

/** The monthly membership subscription whose id starts with `prefix` (members.json truncates it). */
async function findSubscription(stripe: Stripe, prefix: string): Promise<Stripe.Subscription | null> {
  if (!/^sub_\w{6,}$/.test(prefix)) return null
  for (const price of Object.values(MONTHLY_PRICE_IDS)) {
    for await (const sub of stripe.subscriptions.list({ price, status: "all", limit: 100 })) {
      if (sub.id.startsWith(prefix) && !["canceled", "incomplete_expired"].includes(sub.status)) return sub
    }
  }
  return null
}
