/** Server-side: every annotation ever published on one transaction or address, newest first. */

import { KIND_ATTESTATION, KIND_COMMENT, KIND_PROFILE, isComment, parseAttestations, parseProfiles } from "./nostr-conventions"
import { coordinatorPubkey, queryRelays, siteIdentity } from "./nostr-server"

export interface AnnotationVersion {
  id: string
  at: string
  pubkey: string
  name: string
  content: string
  /** Every tag but i/k, in order: ["category", "rental"], ["t", "vat-check"]… */
  tags: string[][]
}

export async function loadAnnotationHistory(uris: string[]): Promise<Record<string, AnnotationVersion[]>> {
  const out: Record<string, AnnotationVersion[]> = Object.fromEntries(uris.map((u) => [u, []]))
  if (uris.length === 0) return out
  const events = (await queryRelays({ kinds: [KIND_COMMENT], "#i": uris, limit: 500 })).filter((e) => !isComment(e))
  if (events.length === 0) return out
  const authors = [...new Set(events.map((e) => e.pubkey))]
  const providers = [...new Set([siteIdentity()?.pubkey, coordinatorPubkey()].filter((p): p is string => !!p))]
  const [attestations, profiles] = await Promise.all([
    queryRelays({ kinds: [KIND_ATTESTATION], authors: providers, "#p": authors, limit: 300 }),
    queryRelays({ kinds: [KIND_PROFILE], authors, limit: 300 }),
  ])
  const links = parseAttestations(attestations, providers)
  const linkByKey = new Map(links.flatMap((l) => l.keys.map((k) => [k, l] as const)))
  const profileByKey = new Map(parseProfiles(profiles).map((p) => [p.pubkey, p]))
  const seen = new Set<string>()
  for (const e of events.sort((a, b) => b.created_at - a.created_at)) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    const uri = e.tags.find((t) => t[0] === "i")?.[1]
    if (!uri || !out[uri]) continue
    out[uri].push({
      id: e.id,
      at: new Date(e.created_at * 1000).toISOString(),
      pubkey: e.pubkey,
      name: profileByKey.get(e.pubkey)?.name || linkByKey.get(e.pubkey)?.name || `${e.pubkey.slice(0, 8)}…`,
      content: e.content,
      tags: e.tags.filter((t) => t[0] !== "i" && t[0] !== "k" && t[0] !== "client"),
    })
  }
  return out
}
