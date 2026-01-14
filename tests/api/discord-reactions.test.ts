import { POST } from "@/app/api/discord/reactions/route"
import { auth } from "@/auth"

// Mock the auth function
jest.mock("@/auth", () => ({
  auth: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe("Discord Reactions API", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should return 401 if user is not authenticated", async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)

    const request = new Request("http://localhost:3000/api/discord/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "123",
        messageId: "456",
        emoji: "⭐",
        add: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
  })

  it("should return 500 if accessToken is missing from session", async () => {
    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        discordId: "123",
        username: "testuser",
        // accessToken is missing
      },
    })

    const request = new Request("http://localhost:3000/api/discord/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "123",
        messageId: "456",
        emoji: "⭐",
        add: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Discord access token not available")
  })

  it("should return 400 if required fields are missing", async () => {
    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        discordId: "123",
        username: "testuser",
        accessToken: "test_token",
      },
    })

    const request = new Request("http://localhost:3000/api/discord/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "123",
        // messageId is missing
        emoji: "⭐",
        add: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("Missing required fields")
  })

  it("should successfully add a reaction using user access token", async () => {
    const mockAccessToken = "user_oauth_token_12345"
    const mockChannelId = "1234567890"
    const mockMessageId = "9876543210"
    const mockEmoji = "⭐"

    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        discordId: "123",
        username: "testuser",
        accessToken: mockAccessToken,
      },
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
    })

    const request = new Request("http://localhost:3000/api/discord/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: mockChannelId,
        messageId: mockMessageId,
        emoji: mockEmoji,
        add: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify the Discord API was called correctly
    expect(global.fetch).toHaveBeenCalledWith(
      `https://discord.com/api/v10/channels/${mockChannelId}/messages/${mockMessageId}/reactions/${encodeURIComponent(mockEmoji)}/@me`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
          "Content-Length": "0",
        },
      }
    )
  })

  it("should successfully remove a reaction using user access token", async () => {
    const mockAccessToken = "user_oauth_token_12345"
    const mockChannelId = "1234567890"
    const mockMessageId = "9876543210"
    const mockEmoji = "⭐"

    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        discordId: "123",
        username: "testuser",
        accessToken: mockAccessToken,
      },
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
    })

    const request = new Request("http://localhost:3000/api/discord/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: mockChannelId,
        messageId: mockMessageId,
        emoji: mockEmoji,
        add: false,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify DELETE method was used
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "DELETE",
      })
    )
  })

  it("should handle Discord API errors", async () => {
    ;(auth as jest.Mock).mockResolvedValue({
      user: {
        discordId: "123",
        username: "testuser",
        accessToken: "test_token",
      },
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue("Missing Permissions"),
    })

    const request = new Request("http://localhost:3000/api/discord/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "123",
        messageId: "456",
        emoji: "⭐",
        add: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain("Failed to add reaction")
  })
})
