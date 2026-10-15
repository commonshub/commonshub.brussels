/** Client-safe: what the bridge of a member's page (lib/member-pages.ts) may read for it. */

/** Paths the bridge fetches for the page, with the viewer's session: reads of the dataset only. */
export function bridgeAllows(p: string): boolean {
  if (typeof p !== "string" || p.length > 300 || !p.startsWith("/")) return false
  if (p.includes("..") || p.includes("\\") || p.includes("//")) return false
  return /^\/(data|opendata)(\/[A-Za-z0-9_.\-/]*)?(\?[A-Za-z0-9_.\-=&%]*)?$/.test(p)
}

/** A member's page in full screen: /members/<username>/<slug>.html, or /<alias>.html. */
export const isFullScreenPage = (pathname: string | null | undefined): boolean => !!pathname && /^\/(members\/[^/]+\/)?[^/]+\.html$/.test(pathname)

/** "membership-v2.html" → { slug: "membership-v2", fullScreen: true }. */
export function pageSegment(segment: string): { slug: string; fullScreen: boolean } {
  const slug = decodeURIComponent(segment)
  return slug.endsWith(".html") ? { slug: slug.slice(0, -5), fullScreen: true } : { slug, fullScreen: false }
}
