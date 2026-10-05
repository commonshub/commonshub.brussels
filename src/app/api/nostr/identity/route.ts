import { NextResponse } from "next/server"
import * as nip19 from "nostr-tools/nip19"
import { APP_NAME, KIND_ATTESTATION, KIND_COMMUNITY, KIND_RSVP, KIND_SHIFT, communityCoordinate } from "@/lib/nostr-conventions"
import { COMMUNITY, RELAYS, coordinatorPubkey, ensureFollows, followedPubkeys, siteIdentity } from "@/lib/nostr-server"

/**
 * How this site shows up on the community relays: its key (to allow-list
 * or to follow as an identity provider), the coordinator whose shifts it
 * RSVPs to, the keys it follows (whose annotations chb trusts through it),
 * and the filters that pick out this community and this app.
 */
export async function GET() {
  // Keep the contact list up to date (once per process); a relay that is down only delays it.
  await ensureFollows().catch((error) => console.error("[nostr] could not publish the contact list:", error))
  const site = siteIdentity()
  const coordinator = coordinatorPubkey()
  return NextResponse.json({
    app: APP_NAME,
    site: site ? { npub: site.npub, pubkey: site.pubkey } : null,
    coordinator: coordinator ? { npub: nip19.npubEncode(coordinator), pubkey: coordinator } : null,
    community: {
      discordGuildId: COMMUNITY.guildId,
      name: COMMUNITY.name,
      definition: site ? communityCoordinate(site.pubkey, COMMUNITY) : null,
      filter: { "#i": [`discord:${COMMUNITY.guildId}`] },
    },
    appFilter: { "#t": [`app:${APP_NAME}`] },
    kinds: {
      profile: 0,
      shift: KIND_SHIFT,
      rsvp: KIND_RSVP,
      identityAttestation: KIND_ATTESTATION,
      communityDefinition: KIND_COMMUNITY,
    },
    memberDirectory: site ? { kinds: [KIND_ATTESTATION], authors: [site.pubkey] } : null,
    follows: followedPubkeys().map((pubkey) => ({ npub: nip19.npubEncode(pubkey), pubkey })),
    relays: RELAYS,
    docs: "https://commonshub.brussels/docs/nostr.md",
  })
}
