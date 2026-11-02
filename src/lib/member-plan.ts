/**
 * The signed-in member's membership plan, for the dashboard (/), and
 * changing what an individual pays each month (€10, €15 or €20).
 *
 * The member is found the way /api/members/me finds them: from the session
 * (their Discord account, else the salted hash of their email), never from an
 * id the browser sends. Their plan is their entry in the members tier's
 * members.json, which carries no email address. A monthly card subscription
 * is changed on Stripe: the new amount applies from the next payment.
 * Yearly plans (and Odoo or bank-transfer ones) change at renewal. A monthly
 * card membership can also be cancelled: it runs until the period paid for ends.
 */

import * as fs from "fs"
import * as path from "path"
import Stripe from "stripe"

import { tierDir } from "./data-paths"
import { readChanges, saveChange } from "./plan-changes-cache"
import { discordIdentifier, emailIdentifier, memberIdForEmail, membershipSalt, nameTokenHash, nameTokens, resolveMemberId } from "./membership"
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
  /** Found by their name (they said it's theirs), not by an address of theirs: not changed here until they confirm one. */
  byName?: boolean
  /** Just paid from the dashboard: not in chb's members list yet. */
  pending?: boolean
  /** YYYY-MM-DD: they cancelled; still a member until then, with no further payment. */
  endsOn?: string | null
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
    ...(m.cancelsOn ? { endsOn: m.cancelsOn.slice(0, 10) } : {}),
  }
}

/** Their plan with what they changed here since chb last pulled it: an amount or a taken-back cancellation for 3 days, a cancellation until it ends. */
export function withChanges(plan: MemberPlan, id: string, all = readChanges(), now = new Date()): MemberPlan {
  const c = all[id]
  if (!c) return plan
  const out = { ...plan }
  const recent = now.getTime() - Date.parse(c.at) < 3 * 86_400_000
  if (c.amount && recent) out.amount = c.amount
  if (c.endsOn && c.endsOn >= now.toISOString().slice(0, 10)) out.endsOn = c.endsOn
  if (c.endsOn === null && recent) out.endsOn = null
  return out
}

/**
 * The session user's plan, or null when we can't find them among the members.
 * `linked`: other membership ids of theirs, from addresses they confirmed
 * (lib/discord-links.ts): someone who pays with another email than their
 * Discord one.
 */
export function planFor(user: { discordId?: string | null; email?: string | null }, dir?: string, linked: string[] = []): MemberPlan | null {
  const entry = entryFor(user, linked, dir)
  return entry ? planOf(entry) : null
}

/** members.json shortens Stripe ids, ending them with "..." ("sub_1PkX3bFAha..."): the beginning of the full id. */
export const subPrefix = (id: string) => id.replace(/(\.{3}|…)$/, "")

/** `subscriptions`: Stripe subscriptions they paid from the dashboard (members.json ids are their beginnings). */
function entryFor(user: { discordId?: string | null; email?: string | null }, linked: string[], dir?: string, subscriptions: string[] = []): Member | null {
  const ids = [memberIdOf(user), ...linked].filter((id): id is string => !!id)
  const members = ids.length || subscriptions.length ? readMembers(dir) : null
  if (!members) return null
  const entries = [
    ...ids.map((id) => memberEntry(id, members)),
    ...members.filter((m) => m.source === "stripe" && subPrefix(m.id).length >= 10 && subscriptions.some((sub) => sub.startsWith(subPrefix(m.id)))),
  ].filter((m): m is Member => !!m)
  return entries.find((m) => m.status === "active" || m.status === "trialing") ?? entries[0] ?? null
}

type Link = { discordId: string; emailHash: string; source: string; paid?: { subscription: string; amount: number; interval: "month" | "year"; at: string } }

/** Every Discord ↔ membership link from logins, confirmed addresses and names (imported on demand: it reads the relays). */
const allLinks = (): Promise<Link[]> => import("./discord-links").then((m) => m.cachedLinks()).catch(() => [])

/** A member's own links: confirmed (login or a code), name-matched, and payments from the dashboard (which stand for that subscription only). */
function linksOf(discordId: string | null | undefined, links: Link[]) {
  const mine = links.filter((l) => l.discordId === discordId)
  return {
    confirmed: mine.filter((l) => l.source !== "name" && l.source !== "checkout").map((l) => l.emailHash),
    byName: mine.filter((l) => l.source === "name").map((l) => l.emailHash),
    paid: mine.flatMap((l) => (l.source === "checkout" && l.paid ? [l.paid] : [])),
  }
}

/**
 * The membership whose name matches a Discord name, ignoring case, accents
 * and word order, by the fingerprints chb publishes (accounts.nameTokens):
 * among current members not linked to a Discord account yet, the one whose
 * name has all the Discord name's words ("Miriam" → "Dean Miriam"). The
 * same words exactly win over more words; anything but a single match is no
 * match. The member still has to say it's theirs.
 */
export function nameCandidate(discordName: string, members: Member[], linked: Set<string>): Member | null {
  const mine = nameTokens(discordName).map(nameTokenHash).filter((h): h is string => !!h)
  if (!mine.length) return null
  const current = new Map<string, Member>()
  for (const m of members) {
    const tokens = m.accounts?.nameTokens
    if (!tokens?.length || m.accounts.discord || linked.has(m.accounts.emailHash)) continue
    if (!["active", "trialing", "grace", "past_due"].includes(m.status)) continue
    if (mine.every((h) => tokens.includes(h))) current.set(m.accounts.emailHash, m)
  }
  const all = [...current.values()]
  const exact = all.filter((m) => new Set(m.accounts.nameTokens).size === mine.length)
  if (exact.length) return exact.length === 1 ? exact[0] : null
  return all.length === 1 ? all[0] : null
}

/** What the member is asked to confirm: no name, just the plan. */
export interface PlanCandidate {
  amount: number
  interval: "month" | "year"
  /** YYYY-MM-DD, when the membership started. */
  since: string
  /** Its email, masked ("x…@gmail.com"), when chb gives one. */
  emailHint?: string
}

/** The membership a signed-in member's Discord name matches, if any (nameCandidate). */
export async function candidateFor(discordId: string, links?: Link[]): Promise<Member | null> {
  const members = readMembers()
  if (!members || !membershipSalt()) return null
  const who = await import("./day-data").then((m) => m.lookupMember(discordId)).catch(() => null)
  if (!who) return null
  return nameCandidate(who.name, members, new Set((links ?? (await allLinks())).map((l) => l.emailHash)))
}

/** A payment from the dashboard that chb's members list doesn't have yet (it's pulled hourly): shown as is, changed once it's there. */
function justPaid(paid: NonNullable<Link["paid"]>[], now = Date.now()): MemberPlan | null {
  const p = paid.filter((x) => now - Date.parse(x.at) < 3 * 86_400_000).sort((a, b) => b.at.localeCompare(a.at))[0]
  return p ? { amount: p.amount, interval: p.interval, source: "stripe", status: "active", renewsOn: null, organisation: false, canChange: false, pending: true } : null
}

/**
 * The member's plan, with the addresses they confirmed (or a payment they made from the dashboard); else one they said
 * is theirs by name (shown, but only changed once they confirm the address
 * they pay with); else a membership whose name matches theirs, to ask them.
 */
export async function findPlan(user: { discordId?: string | null; email?: string | null }): Promise<{ plan: MemberPlan | null; candidate: PlanCandidate | null }> {
  const links = user.discordId ? await allLinks() : []
  const { confirmed, byName, paid } = linksOf(user.discordId, links)
  const entry = entryFor(user, confirmed, undefined, paid.map((p) => p.subscription))
  const named = byName.length ? planFor({}, undefined, byName) : null
  const plan = (entry && withChanges(planOf(entry), entry.id)) ?? (named && { ...named, canChange: false, byName: true }) ?? justPaid(paid)
  if (plan || !user.discordId) return { plan, candidate: null }
  const c = await candidateFor(user.discordId, links)
  return { plan: null, candidate: c ? { amount: c.amount.value, interval: c.interval, since: c.createdAt.slice(0, 10), ...(c.accounts.emailHint ? { emailHint: c.accounts.emailHint } : {}) } : null }
}

type Failure = { ok: false; error: string; status: number }

/** The signed-in member's monthly card subscription on Stripe, found from the (truncated) id in members.json. */
async function myCardSubscription(user: { discordId?: string | null; email?: string | null }): Promise<{ ok: true; entry: Member; stripe: Stripe; sub: Stripe.Subscription } | Failure> {
  const mine = linksOf(user.discordId, user.discordId ? await allLinks() : [])
  const entry = entryFor(user, mine.confirmed, undefined, mine.paid.map((p) => p.subscription))
  if (!entry) return { ok: false, error: "We can't find your membership. Write to hello@commonshub.brussels and we'll sort it out.", status: 404 }
  if (!planOf(entry).canChange) return { ok: false, error: "Your plan can only be changed when it renews.", status: 409 }
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return { ok: false, error: "Card payments are not available right now, please try again later.", status: 503 }
  const stripe = new Stripe(key)
  const sub = await findSubscription(stripe, subPrefix(entry.id))
  if (!sub) return { ok: false, error: "We can't find your card subscription. Write to hello@commonshub.brussels and we'll sort it out.", status: 404 }
  return { ok: true, entry, stripe, sub }
}

/**
 * Change a member's monthly amount. Their Stripe subscription is found from
 * the (truncated) id in members.json, among the membership's monthly
 * subscriptions; the price is swapped without proration, so the new amount
 * is what they pay from their next payment on.
 */
export async function changeMonthlyAmount(user: { discordId?: string | null; email?: string | null }, amount: number): Promise<{ ok: true; amount: MonthlyPrice; from: number } | Failure> {
  const target = MONTHLY_PRICES.find((p) => p.amount === amount)?.amount
  if (!target) return { ok: false, error: "Choose €10, €15 or €20 a month", status: 400 }
  const found = await myCardSubscription(user)
  if (!found.ok) return found
  const { entry, stripe, sub } = found
  const item = sub.items.data.find((i) => i.price.product === settings.membership.stripe.productId) ?? sub.items.data[0]
  const from = (item.price.unit_amount ?? 0) / 100
  if (item.price.id !== MONTHLY_PRICE_IDS[target]) {
    await stripe.subscriptions.update(sub.id, { items: [{ id: item.id, price: MONTHLY_PRICE_IDS[target] }], proration_behavior: "none", metadata: { ...sub.metadata, changedFrom: String(from), changedVia: "website" } })
  }
  saveChange(entry.id, { amount: target })
  return { ok: true, amount: target, from }
}

/**
 * Cancel a member's monthly card membership at the end of the period they
 * paid for (no refund, no further payment), or take that back while it
 * hasn't ended. Returns the day it ends, or null when it goes on.
 */
export async function cancelMembership(user: { discordId?: string | null; email?: string | null }, cancel: boolean): Promise<{ ok: true; endsOn: string | null; changed: boolean } | Failure> {
  const found = await myCardSubscription(user)
  if (!found.ok) return found
  const { entry, stripe, sub } = found
  const changed = sub.cancel_at_period_end !== cancel
  const updated = changed ? await stripe.subscriptions.update(sub.id, { cancel_at_period_end: cancel, metadata: { ...sub.metadata, ...(cancel ? { cancelledVia: "website" } : { resumedVia: "website" }) } }) : sub
  const at = updated.cancel_at ?? (cancel ? Date.parse(entry.currentPeriodEnd) / 1000 : null)
  const endsOn = cancel && at ? new Date(at * 1000).toISOString().slice(0, 10) : null
  saveChange(entry.id, { endsOn })
  return { ok: true, endsOn, changed }
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
