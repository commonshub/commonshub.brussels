/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals"
import { attachmentExpiry, attachmentKey, freshAttachmentUrl, isDiscordAttachmentUrl, isExpired, resetRenewals } from "@/lib/discord-attachments"

const hex = (s: number) => Math.floor(s).toString(16)
const now = Date.now() / 1000
const link = (id: string, ex: number) => `https://cdn.discordapp.com/attachments/1297965144579637248/${id}/photo.jpg?ex=${hex(ex)}&is=0&hm=abc&`

describe("discord attachment links", () => {
  test("recognised, keyed without the signature, expiry read from ex", () => {
    const url = link("111", now + 3600)
    expect(isDiscordAttachmentUrl(url)).toBe(true)
    expect(isDiscordAttachmentUrl("https://cdn.discordapp.com/avatars/1/a.png")).toBe(false)
    expect(attachmentKey(url)).toBe("cdn.discordapp.com/attachments/1297965144579637248/111/photo.jpg")
    expect(attachmentExpiry(url)).toBe(Math.floor(now + 3600))
    expect(isExpired(url, now)).toBe(false)
    expect(isExpired(link("111", now - 10), now)).toBe(true)
  })
})

describe("freshAttachmentUrl", () => {
  const fetchMock = jest.fn<typeof fetch>()
  beforeEach(() => {
    resetRenewals()
    process.env.DISCORD_BOT_TOKEN = "t"
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => resetRenewals())

  test("a valid link is used as is, without calling Discord", async () => {
    const url = link("1", now + 3600)
    expect(await freshAttachmentUrl(url)).toBe(url)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("expired links are renewed in one batch and remembered", async () => {
    const a = link("1", now - 10)
    const b = link("2", now - 10)
    fetchMock.mockImplementation(async (_input, init) => {
      const { attachment_urls } = JSON.parse(String(init!.body)) as { attachment_urls: string[] }
      return new Response(JSON.stringify({ refreshed_urls: attachment_urls.map((u) => ({ original: u, refreshed: u.replace(/ex=[0-9a-f]+/, `ex=${hex(now + 86400)}`) })) }))
    })
    const [fa, fb] = await Promise.all([freshAttachmentUrl(a), freshAttachmentUrl(b)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(isExpired(fa)).toBe(false)
    expect(attachmentKey(fb)).toBe(attachmentKey(b))
    expect(await freshAttachmentUrl(a)).toBe(fa) // remembered
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("no token or a Discord error: the original link, no throw", async () => {
    const url = link("3", now - 10)
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }))
    expect(await freshAttachmentUrl(url)).toBe(url)
    delete process.env.DISCORD_BOT_TOKEN
    expect(await freshAttachmentUrl(link("4", now - 10))).toContain("/4/")
  })
})
