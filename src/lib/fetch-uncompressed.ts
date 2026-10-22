/**
 * fetch() for URLs whose content we don't control (remote images, pages
 * linked from the newsletter), without ever decompressing the response.
 *
 * Bun's fetch decodes gzip/brotli bodies by itself, whatever we asked for,
 * and its brotli decoder has a remote code execution bug (CVE-2026-111497;
 * bun 1.3.11 to 1.4.3, no fixed release yet). Asking for an uncompressed
 * body and turning decompression off keeps the decoder out of reach; a
 * server that still sends a compressed body gets an error, never decoded.
 * Images are served uncompressed anyway.
 */
export async function fetchUncompressed(url: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
  const headers = { ...init.headers, "Accept-Encoding": "identity" }
  // `decompress` is Bun's own fetch option (not in the DOM types).
  const response = await fetch(url, { ...init, headers, decompress: false } as RequestInit)
  const encoding = response.headers?.get("content-encoding")?.trim().toLowerCase()
  if (encoding && encoding !== "identity") {
    await response.body?.cancel().catch(() => {})
    throw new Error(`refused a compressed response (${encoding}) from ${new URL(url).hostname}`)
  }
  return response
}
