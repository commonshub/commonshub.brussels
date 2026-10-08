/**
 * The site's address as the visitor sees it, for links that leave the site
 * and come back (Stripe's return pages, sign-in redirects). Behind the proxy
 * `request.url` is the container's own (https://0.0.0.0:3000), so the
 * address comes from the forwarded or Host header; then BASE_URL; then the
 * site itself.
 */
const FALLBACK = "https://commonshub.brussels"

export function publicOrigin(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwarded || request.headers.get("host")?.trim()
  if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|\[::\])(:\d+)?$/.test(host)) {
    const local = /^localhost(:\d+)?$/.test(host)
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https")
    return `${proto}://${host}`
  }
  try {
    if (process.env.BASE_URL) return new URL(process.env.BASE_URL).origin
  } catch {}
  return FALLBACK
}
