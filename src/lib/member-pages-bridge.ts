/** Client-safe: what the bridge of a member's page (lib/member-pages.ts) may read for it. */

/** Paths the bridge fetches for the page, with the viewer's session: reads of the dataset only. */
export function bridgeAllows(p: string): boolean {
  if (typeof p !== "string" || p.length > 300 || !p.startsWith("/")) return false
  if (p.includes("..") || p.includes("\\") || p.includes("//")) return false
  return /^\/(data|opendata)(\/[A-Za-z0-9_.\-/]*)?(\?[A-Za-z0-9_.\-=&%]*)?$/.test(p)
}
