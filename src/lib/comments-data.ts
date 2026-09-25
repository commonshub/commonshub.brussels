/** Server-side: the comments on one item, read from the community relays. */

import { KIND_ATTESTATION, KIND_COMMENT, KIND_PROFILE, type CommentView, parseAttestations, parseComments, parseProfiles } from "./nostr-conventions"
import { coordinatorPubkey, queryRelays, siteIdentity } from "./nostr-server"

export async function loadComments(uri: string): Promise<CommentView[]> {
  const events = await queryRelays({ kinds: [KIND_COMMENT], "#I": [uri], limit: 200 })
  if (events.length === 0) return []
  const authors = [...new Set(events.map((e) => e.pubkey))]
  const providers = [...new Set([siteIdentity()?.pubkey, coordinatorPubkey()].filter((p): p is string => !!p))]
  const [attestations, profiles] = await Promise.all([
    queryRelays({ kinds: [KIND_ATTESTATION], authors: providers, "#p": authors, limit: 300 }),
    queryRelays({ kinds: [KIND_PROFILE], authors, limit: 300 }),
  ])
  return parseComments(events, uri, parseAttestations(attestations, providers), parseProfiles(profiles))
}
