import { currentDiscordAvatar } from "@/lib/discord-avatar"

test("a changed Discord avatar: the member's current one, looked up once an hour", async () => {
  process.env.DISCORD_BOT_TOKEN = "bot"
  let calls = 0
  const fetcher = (async () => (calls++, new Response(JSON.stringify({ avatar: "newhash" })))) as unknown as typeof fetch
  const old = "https://cdn.discordapp.com/avatars/907316481405124628/e1bb2c0b82e865bc44911b90bbc4d2c2.png"
  expect(await currentDiscordAvatar(old, 1_000, fetcher)).toBe("https://cdn.discordapp.com/avatars/907316481405124628/newhash.png?size=256")
  expect(await currentDiscordAvatar(old, 2_000, fetcher)).toBe("https://cdn.discordapp.com/avatars/907316481405124628/newhash.png?size=256")
  expect(calls).toBe(1)
  expect(await currentDiscordAvatar("https://example.org/a.png", 1_000, fetcher)).toBe(null)
})
