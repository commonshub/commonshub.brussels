/**
 * Members whose Odoo partner has no email are asked for one on the
 * dashboard. chb (which owns Odoo) lists them, by Discord id only, in
 * latest/members/discord-partners.json ({needsEmail: [discordId]}).
 *
 * The member proves the address with a 6-digit code mailed to it (stateless,
 * lib/member-link-code.ts, keyed on AUTH_SECRET). The address then goes to
 * chb alone: one Nostr event, signed by the site, encrypted (NIP-44) to
 * chb's key with a throwaway key whose public half rides along (`epk`), so
 * the site can't read it back. chb sets it on the partner. The site keeps
 * only the membership id (the address's salted hash, lib/discord-links.ts).
 */

import { createHmac } from "crypto"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { getConversationKey, encrypt } from "nostr-tools/nip44"

import { readTierJson } from "./dataset"
import { publishAsSite, siteIdentity } from "./nostr-server"
import settings from "@/settings/settings.json"

const KIND_APP_DATA = 30078
const T_TAG = "partner-email"

/** chb's Nostr public key (hex): CHB_NOSTR_PUBKEY, else settings.nostr.chbPubkey. */
export function chbPubkey(): string | null {
  const key = process.env.CHB_NOSTR_PUBKEY || (settings as { nostr?: { chbPubkey?: string } }).nostr?.chbPubkey || ""
  return /^[0-9a-f]{64}$/.test(key) ? key : null
}

/** Whether chb lists this member as having no email on their partner. */
export function needsEmail(discordId: string): boolean {
  const file = readTierJson<{ needsEmail?: string[] }>("members", "discord-partners.json")
  return !!file?.needsEmail?.includes(discordId)
}

/** The secret for the codes: derived from AUTH_SECRET, so nothing else to configure. */
export function codeSecret(): string | null {
  return process.env.AUTH_SECRET ? `partner-email:${process.env.AUTH_SECRET}` : null
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Hand the verified address to chb, readable by chb only. */
export async function sendToChb(discordId: string, email: string, now = new Date()): Promise<void> {
  const chb = chbPubkey()
  const site = siteIdentity()
  if (!chb || !site) throw new Error("Not configured")
  const ephemeral = generateSecretKey()
  const content = encrypt(JSON.stringify({ discordId, email: normalizeEmail(email), verifiedAt: now.toISOString() }), getConversationKey(ephemeral, chb))
  const d = `${T_TAG}:${createHmac("sha256", Buffer.from(site.secretKey)).update(`partner-email:${discordId}`).digest("base64url").slice(0, 32)}`
  const result = await publishAsSite({
    kind: KIND_APP_DATA,
    created_at: Math.floor(now.getTime() / 1000),
    tags: [
      ["d", d],
      ["t", T_TAG],
      ["p", chb],
      ["epk", getPublicKey(ephemeral)],
    ],
    content,
  })
  ephemeral.fill(0)
  if (!result.accepted.length) throw new Error("Could not save your email, please try again")
}
