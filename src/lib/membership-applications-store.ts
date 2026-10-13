/**
 * Where membership applications are kept: on the community relays, as one
 * addressable event per application (kind 30078, `d` =
 * `membership-application:<id>`), signed by the site and encrypted to the
 * site's own key (NIP-44). The relays only ever see ciphertext: the name,
 * the answers and the email address are readable by the site alone, which
 * shows members everything but the email address (/members/pending) and
 * uses the address only to write to the applicant. A newer version of the
 * event (approved, paid) replaces the older one.
 *
 * Vouches are public NIP-22 comments signed by the members themselves
 * (lib/membership-application.ts buildVouch); they say who vouched, not for
 * whom beyond an opaque application id.
 */

import { getConversationKey, encrypt, decrypt } from "nostr-tools/nip44"

import { sendDirectMessage, sendMessage, isDiscordConfigured } from "./discord"
import { tokenBalanceOf } from "./token-balance"
import settings from "@/settings/settings.json"
import { formatAddress, fromSite } from "./email-address"
import { buildWelcomeEmail } from "./membership-welcome"
import { KIND_ATTESTATION, KIND_COMMENT, latestAddressable, parseAttestations } from "./nostr-conventions"
import { COMMUNITY, coordinatorPubkey, publishAsSite, queryRelays, siteIdentity } from "./nostr-server"
import {
  HELLO,
  PENDING_URL,
  VOUCHES_NEEDED,
  applicationUri,
  buildAcceptedEmail,
  buildReceivedEmail,
  paymentUrlFor,
  vouchersOf,
  type Application,
} from "./membership-application"

export const KIND_APP_DATA = 30078
const D_PREFIX = "membership-application:"
const T_TAG = "membership-application"

function key(): { secretKey: Uint8Array; pubkey: string; conversation: Uint8Array } {
  const id = siteIdentity()
  if (!id) throw new Error("No Nostr identity: AUTH_SECRET is not set")
  return { ...id, conversation: getConversationKey(id.secretKey, id.pubkey) }
}

export const isApplicationsConfigured = () => !!siteIdentity()

/** Save (or replace) an application on the relays. */
export async function saveApplication(a: Application): Promise<void> {
  const k = key()
  await publishAsSite({
    kind: KIND_APP_DATA,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["d", `${D_PREFIX}${a.id}`],
      ["t", T_TAG],
      ["status", a.status],
    ],
    content: encrypt(JSON.stringify(a), k.conversation),
  })
}

/** Every application, newest first. */
export async function listApplications(): Promise<Application[]> {
  const k = key()
  const events = await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#t": [T_TAG], limit: 500 }, 4000)
  const out: Application[] = []
  for (const e of latestAddressable(events)) {
    try {
      out.push(JSON.parse(decrypt(e.content, k.conversation)) as Application)
    } catch {
      /* not ours, or damaged */
    }
  }
  return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export async function getApplication(id: string): Promise<Application | null> {
  return (await listApplications()).find((a) => a.id === id) ?? null
}

// ── vouches ─────────────────────────────────────────────────────────────────

/** Members with tokens, by Discord id: asked once per process for an hour. */
const tokenCache = new Map<string, { at: number; has: boolean }>()
export async function hasTokens(discordId: string): Promise<boolean> {
  const cached = tokenCache.get(discordId)
  if (cached && Date.now() - cached.at < 3_600_000) return cached.has
  const has = (await tokenBalanceOf(discordId).catch(() => 0)) > 0
  tokenCache.set(discordId, { at: Date.now(), has })
  return has
}

/** Who vouched for each application (members with tokens, one each), by application id. */
export async function loadVouchers(ids: string[]): Promise<Map<string, Array<{ discordId: string; name: string; at: string }>>> {
  const result = new Map<string, Array<{ discordId: string; name: string; at: string }>>()
  if (!ids.length) return result
  const events = (await queryRelays({ kinds: [KIND_COMMENT], "#I": ids.map(applicationUri), "#t": ["vouch"], limit: 1000 }, 4000))
  const authors = [...new Set(events.map((e) => e.pubkey))]
  const providers = [...new Set([siteIdentity()?.pubkey, coordinatorPubkey()].filter((p): p is string => !!p))]
  const attestations = authors.length ? await queryRelays({ kinds: [KIND_ATTESTATION], authors: providers, "#p": authors, limit: 500 }) : []
  const links = parseAttestations(attestations, providers)
  const discordIds = [...new Set(links.filter((l) => l.keys.some((k) => authors.includes(k))).map((l) => l.discordId))]
  const holders = new Set((await Promise.all(discordIds.map(async (d) => ((await hasTokens(d)) ? d : null)))).filter(Boolean))
  for (const id of ids) result.set(id, vouchersOf(events, id, links, (d) => holders.has(d)))
  return result
}

// ── emails ──────────────────────────────────────────────────────────────────

async function sendEmail(to: string, name: string, email: { subject: string; html: string; text: string }, cc = true): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY is not set")
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromSite(), to: [formatAddress(name, to)], ...(cc ? { cc: [HELLO] } : {}), reply_to: [HELLO], ...email }),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  return body.id || ""
}

export const sendReceived = (a: Application) => sendEmail(a.email, a.name, buildReceivedEmail(a))
export const sendAccepted = (a: Application, vouchers: Array<{ name: string }>) => sendEmail(a.email, a.name, buildAcceptedEmail(a, vouchers, paymentUrlFor(a)))
export const sendOnboarding = (a: Pick<Application, "email" | "name" | "type">) =>
  sendEmail(a.email, a.name, buildWelcomeEmail({ name: a.type === "individual" ? a.name.split(" ")[0] : a.name, email: a.email, organisation: a.type === "organisation" }))

const REQUESTS = settings.discord.channels.requests

/** Approve an application once enough members with tokens vouched; tell them and the community. Returns the vouchers. */
const approving = new Set<string>()
export async function approveIfVouched(id: string): Promise<{ status: Application["status"]; vouchers: Array<{ name: string }> } | null> {
  const a = await getApplication(id)
  if (!a) return null
  const vouchers = (await loadVouchers([id])).get(id) ?? []
  if (a.status !== "pending" || vouchers.length < VOUCHES_NEEDED || approving.has(id)) return { status: a.status, vouchers }
  approving.add(id)
  try {
    const approved: Application = { ...a, status: "approved", approvedAt: new Date().toISOString(), vouchers: vouchers.map(({ discordId, name }) => ({ discordId, name })) }
    await saveApplication(approved)
    await sendAccepted(approved, vouchers)
    if (isDiscordConfigured()) {
      sendMessage(REQUESTS, `✅ **${a.name}**'s membership application was approved: ${vouchers.map((v) => `<@${v.discordId}>`).join(", ")} vouched. They got the payment link.`).catch(() => {})
      for (const v of vouchers) sendDirectMessage(v.discordId, `✅ ${a.name} was accepted as a member, thanks to your vouch. Say hi when you see them at the hub!`).catch(() => {})
    }
    return { status: "approved", vouchers }
  } finally {
    approving.delete(id)
  }
}

/** A paid application: send the onboarding email (once) and mark them a member. */
export async function onboardPaid(id: string): Promise<boolean> {
  const a = await getApplication(id)
  if (!a || a.status === "member") return false
  await sendOnboarding(a)
  await saveApplication({ ...a, status: "member", paidAt: new Date().toISOString() })
  if (isDiscordConfigured()) sendMessage(REQUESTS, `🎉 **${a.name}** paid their membership and got the onboarding email. Welcome! (${PENDING_URL})`).catch(() => {})
  return true
}

export { COMMUNITY }
