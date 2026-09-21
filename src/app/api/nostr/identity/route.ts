import { NextResponse } from "next/server"
import { HUB_PUBKEY, RELAYS, siteIdentity } from "@/lib/nostr-server"
import * as nip19 from "nostr-tools/nip19"

/**
 * This deployment's Nostr identity, so its pubkey can be allow-listed on the
 * community relay. Public: a pubkey is meant to be shared.
 */
export async function GET() {
  const identity = siteIdentity()
  return NextResponse.json({
    site: identity ? { npub: identity.npub, pubkey: identity.pubkey } : null,
    hub: HUB_PUBKEY ? { npub: nip19.npubEncode(HUB_PUBKEY), pubkey: HUB_PUBKEY } : null,
    relays: RELAYS,
    note: "Shift sign-ups are NIP-52 RSVPs (kind 31925) by the site key, pointing at the hub's shift events (kind 31923).",
  })
}
