/**
 * The newsletter lives on Paragraph (settings.json newsletter). Someone who
 * asks for it on the site is added there directly with the Paragraph API
 * (POST /v1/subscribers, the publication's API key in PARAGRAPH_API_KEY), so
 * there is one list and nothing to sync. The address goes to Paragraph and is
 * not kept here.
 */

const API = "https://public.api.paragraph.com/api/v1"

export const isParagraphConfigured = () => !!process.env.PARAGRAPH_API_KEY

export async function subscribeToNewsletter(email: string): Promise<boolean> {
  const key = process.env.PARAGRAPH_API_KEY
  if (!key) return false
  try {
    const res = await fetch(`${API}/subscribers`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    })
    if (!res.ok) console.error(`[paragraph] could not add a subscriber: ${res.status} ${(await res.text()).slice(0, 200)}`)
    return res.ok
  } catch (error) {
    console.error("[paragraph] could not add a subscriber:", error)
    return false
  }
}
