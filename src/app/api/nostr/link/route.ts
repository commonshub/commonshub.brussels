import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isMember, isSteward } from "@/lib/admin-check"
import { type DiscordIdentity, buildProfile, parseProfiles } from "@/lib/nostr-conventions"
import { RELAYS, attestMember, ensureCommunityDefinition, memberProfile } from "@/lib/nostr-server"

export const dynamic = "force-dynamic"

/**
 * Link this browser's Nostr key to the signed-in Discord member.
 *
 * The site, as identity provider, publishes (or refreshes) its kind 31926
 * attestation for the member with this key added — that is what gives the
 * key write access on relay.commonshub.brussels — and tells the browser
 * whether the key still needs a kind 0 profile, handing it one built from
 * the Discord profile to sign and publish itself.
 */
export async function POST(request: Request) {
  const session = await auth()
  const user = session?.user as { discordId?: string; username?: string; name?: string | null; avatar?: string; image?: string | null } | undefined
  if (!user?.discordId || !(await isMember())) {
    return NextResponse.json({ error: "Sign in as a member" }, { status: 401 })
  }

  let body: { pubkey?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const pubkey = typeof body.pubkey === "string" && /^[0-9a-f]{64}$/.test(body.pubkey) ? body.pubkey : null
  if (!pubkey) return NextResponse.json({ error: "A hex pubkey is required" }, { status: 400 })

  const identity: DiscordIdentity = {
    id: user.discordId,
    name: (user.name || user.username || "member").slice(0, 60),
    username: user.username,
    avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=256` : user.image || undefined,
  }

  try {
    await ensureCommunityDefinition()
    // The attestation also carries the member's community roles: a steward's
    // sign-ups on behalf of others are trusted through it.
    const { keys, changed } = await attestMember(identity, pubkey, (await isSteward()) ? ["steward"] : [])
    const existing = await memberProfile(pubkey)
    const profile = existing ? parseProfiles([existing])[0] : null
    const needsProfile = !profile || !profile.name || profile.discordId !== user.discordId
    return NextResponse.json({
      ok: true,
      keys,
      attested: changed ? "published" : "unchanged",
      profile: needsProfile ? buildProfile(identity) : null,
      relays: RELAYS,
    })
  } catch (error) {
    console.error("[nostr] could not link the key:", error)
    return NextResponse.json({ error: "The relays did not accept the attestation" }, { status: 502 })
  }
}
