/**
 * The last segment of a transaction's page address:
 * /<year>/<month>/transactions/<slug>. The hash for an on-chain or bank
 * transaction ("ethereum:100:tx:0xabc" → "0xabc"), else the provider's own
 * id ("stripe:txn_123" → "txn_123"). Unique enough within one month.
 */
export function txSlug(id: string): string {
  const i = id.indexOf(":tx:")
  return i >= 0 ? id.slice(i + 4) : id.split(":").pop() || id
}

/** The page of a transaction dated `iso` (YYYY-MM-DD, Brussels). */
export function txPagePath(id: string, iso: string): string {
  const [y, m] = iso.split("-")
  return `/${y}/${m}/transactions/${encodeURIComponent(txSlug(id))}`
}
