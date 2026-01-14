/**
 * Discord Message Component Tests
 * Tests that Discord message formatting works correctly
 */

import { describe, test, expect } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import { DiscordMessage } from "@/components/discord-message"

describe("DiscordMessage Component", () => {
  const mockUserMap = {
    "123456789": {
      username: "testuser",
      displayName: "Test User",
    },
    "987654321": {
      username: "anotheruser",
      displayName: "Another User",
    },
  }

  const mockChannelMap = {
    "111222333": "general",
    "444555666": "contributions",
  }

  const guildId = "1234567890"

  describe("User Mentions", () => {
    test("renders user mention as clickable link", () => {
      const content = "Hello <@123456789>, how are you?"

      const { container } = render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // Check that @displayName is rendered
      expect(screen.getByText("@Test User")).toBeInTheDocument()

      // Check that it's a link to the member page
      const link = screen.getByText("@Test User")
      expect(link.tagName).toBe("A")
      expect(link).toHaveAttribute("href", "/members/testuser")
    })

    test("renders multiple user mentions", () => {
      const content = "<@123456789> and <@987654321> are working together"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      expect(screen.getByText("@Test User")).toBeInTheDocument()
      expect(screen.getByText("@Another User")).toBeInTheDocument()
    })

    test("handles unknown user mention", () => {
      const content = "Hello <@999999999>, unknown user"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      expect(screen.getByText("@unknown")).toBeInTheDocument()
    })
  })

  describe("Channel Mentions", () => {
    test("renders channel mention as Discord link", () => {
      const content = "Check out <#111222333> for more info"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      const link = screen.getByText("#general")
      expect(link.tagName).toBe("A")
      expect(link).toHaveAttribute("href", `https://discord.com/channels/${guildId}/111222333`)
      expect(link).toHaveAttribute("target", "_blank")
    })

    test("renders unknown channel mention with fallback", () => {
      const content = "Check out <#999999999>"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      expect(screen.getByText("#channel")).toBeInTheDocument()
    })
  })

  describe("Bare URLs", () => {
    test("renders http URL as clickable link", () => {
      const content = "Check this out: http://example.com"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      const link = screen.getByText("http://example.com")
      expect(link.tagName).toBe("A")
      expect(link).toHaveAttribute("href", "http://example.com")
      expect(link).toHaveAttribute("target", "_blank")
    })

    test("renders https URL as clickable link", () => {
      const content = "Visit https://example.com/page"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      const link = screen.getByText("https://example.com/page")
      expect(link.tagName).toBe("A")
      expect(link).toHaveAttribute("href", "https://example.com/page")
    })

    test("truncates long URLs", () => {
      const longUrl = "https://example.com/" + "a".repeat(100)
      const content = `Check this: ${longUrl}`

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // URL should be truncated to 50 chars + "..."
      const expectedText = longUrl.substring(0, 50) + "..."
      expect(screen.getByText(expectedText)).toBeInTheDocument()
    })
  })

  describe("Markdown Links", () => {
    test("renders markdown link with custom text", () => {
      const content = "Check out [our website](https://example.com)"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      const link = screen.getByText("our website")
      expect(link.tagName).toBe("A")
      expect(link).toHaveAttribute("href", "https://example.com")
      expect(link).toHaveAttribute("target", "_blank")
    })

    test("renders multiple markdown links", () => {
      const content = "Visit [site A](https://a.com) and [site B](https://b.com)"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      const linkA = screen.getByText("site A")
      expect(linkA).toHaveAttribute("href", "https://a.com")

      const linkB = screen.getByText("site B")
      expect(linkB).toHaveAttribute("href", "https://b.com")
    })

    test("markdown link takes precedence over bare URL", () => {
      const content = "[Click here](https://example.com)"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // Should render "Click here" not the URL
      expect(screen.getByText("Click here")).toBeInTheDocument()
      expect(screen.queryByText("https://example.com")).not.toBeInTheDocument()
    })
  })

  describe("Role Mentions", () => {
    test("renders role mention", () => {
      const content = "Thanks <@&777888999>!"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      expect(screen.getByText("@role")).toBeInTheDocument()
    })
  })

  describe("Combined Formatting", () => {
    test("renders message with all formatting types", () => {
      const content = "Hey <@123456789>, check <#111222333> for [our guide](https://guide.example.com) and this link: https://example.com"

      render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // Check user mention
      const userMention = screen.getByText("@Test User")
      expect(userMention).toBeInTheDocument()
      expect(userMention).toHaveAttribute("href", "/members/testuser")

      // Check channel mention
      const channelMention = screen.getByText("#general")
      expect(channelMention).toBeInTheDocument()
      expect(channelMention).toHaveAttribute("href", `https://discord.com/channels/${guildId}/111222333`)

      // Check markdown link
      const markdownLink = screen.getByText("our guide")
      expect(markdownLink).toBeInTheDocument()
      expect(markdownLink).toHaveAttribute("href", "https://guide.example.com")

      // Check bare URL
      const bareUrl = screen.getByText("https://example.com")
      expect(bareUrl).toBeInTheDocument()
      expect(bareUrl).toHaveAttribute("href", "https://example.com")
    })

    test("preserves plain text between formatted elements", () => {
      const content = "Hello <@123456789>, check out https://example.com today!"

      const { container } = render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // Check that plain text is preserved
      expect(container.textContent).toContain("Hello")
      expect(container.textContent).toContain(", check out")
      expect(container.textContent).toContain("today!")
    })
  })

  describe("Image Attachments", () => {
    test("renders image attachments", () => {
      const attachments = [
        {
          url: "https://cdn.example.com/image1.jpg",
          proxyUrl: "https://proxy.example.com/image1.jpg",
          contentType: "image/jpeg",
        },
        {
          url: "https://cdn.example.com/image2.png",
          proxyUrl: "https://proxy.example.com/image2.png",
          contentType: "image/png",
        },
      ]

      const { container } = render(
        <DiscordMessage
          content="Check out these images!"
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
          attachments={attachments}
        />
      )

      // Should have rendered the ImageLightbox component
      expect(container.querySelector(".mt-3")).toBeInTheDocument()
    })

    test("filters non-image attachments", () => {
      const attachments = [
        {
          url: "https://cdn.example.com/image.jpg",
          proxyUrl: "https://proxy.example.com/image.jpg",
          contentType: "image/jpeg",
        },
        {
          url: "https://cdn.example.com/file.pdf",
          proxyUrl: "https://proxy.example.com/file.pdf",
          contentType: "application/pdf",
        },
      ]

      const { container } = render(
        <DiscordMessage
          content="Image and PDF"
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
          attachments={attachments}
        />
      )

      // Should still render (has one image)
      expect(container.querySelector(".mt-3")).toBeInTheDocument()
    })

    test("does not render attachment section when no images", () => {
      const attachments = [
        {
          url: "https://cdn.example.com/file.pdf",
          proxyUrl: "https://proxy.example.com/file.pdf",
          contentType: "application/pdf",
        },
      ]

      const { container } = render(
        <DiscordMessage
          content="PDF only"
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
          attachments={attachments}
        />
      )

      // Should not render attachment section
      expect(container.querySelector(".mt-3")).not.toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    test("handles empty content", () => {
      const { container } = render(
        <DiscordMessage
          content=""
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      expect(container.textContent).toBe("")
    })

    test("handles plain text without any formatting", () => {
      const content = "Just plain text without any special formatting"

      const { container } = render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      expect(container.textContent).toBe(content)
    })

    test("handles malformed markdown link", () => {
      const content = "This is [incomplete markdown link"

      const { container } = render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // Should render as plain text
      expect(container.textContent).toContain("[incomplete markdown link")
    })

    test("preserves whitespace and line breaks", () => {
      const content = "Line 1\n\nLine 2\n  Indented"

      const { container } = render(
        <DiscordMessage
          content={content}
          userMap={mockUserMap}
          channelMap={mockChannelMap}
          guildId={guildId}
        />
      )

      // The component uses whitespace-pre-wrap which preserves whitespace
      expect(container.textContent).toContain("Line 1")
      expect(container.textContent).toContain("Line 2")
    })
  })
})
