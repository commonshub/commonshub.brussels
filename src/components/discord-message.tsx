"use client"

import Link from "next/link"
import { ImageLightbox } from "./image-lightbox"
import type { JSX } from "react"

interface DiscordMessageProps {
  content: string
  userMap: Record<string, { username: string; displayName: string } | string>
  channelMap: Record<string, string>
  guildId: string
  attachments?: Array<{ id: string; url: string; proxyUrl: string; contentType?: string }>
  timestamp?: string
  className?: string
}

export function DiscordMessage({ content, userMap, channelMap, guildId, attachments, timestamp, className }: DiscordMessageProps) {
  const imageAttachments = attachments?.filter(
    (a) => a.contentType?.startsWith("image/") || a.url.match(/\.(jpg|jpeg|png|gif|webp)$/i),
  )

  // Determine text color - use className if provided, otherwise default
  const textColorClass = className?.includes("text-") ? className : `text-foreground/90 ${className || ""}`

  // Check if we're using white text (for dark backgrounds)
  const useWhiteLinks = className?.includes("text-white")

  return (
    <div>
      <p className={`${textColorClass} whitespace-pre-wrap leading-relaxed`}>
        <RichContent
          content={content}
          userMap={userMap}
          channelMap={channelMap}
          guildId={guildId}
          useWhiteLinks={useWhiteLinks}
        />
      </p>
      {imageAttachments && imageAttachments.length > 0 && (
        <div className="mt-3">
          <ImageLightbox
            images={imageAttachments.map((a) => ({
              url: a.url,
              thumbnailUrl: a.proxyUrl || a.url,
              attachmentId: a.id,
              timestamp: timestamp,
            }))}
            thumbnailSize="md"
            userMap={userMap}
            channelMap={channelMap}
            guildId={guildId}
          />
        </div>
      )}
    </div>
  )
}

function RichContent({
  content,
  userMap,
  channelMap,
  guildId,
  useWhiteLinks = false,
}: {
  content: string
  userMap: Record<string, { username: string; displayName: string } | string>
  channelMap: Record<string, string>
  guildId: string
  useWhiteLinks?: boolean
}) {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0

  // Link color based on background
  const linkClass = useWhiteLinks ? "text-white hover:underline" : "text-primary hover:underline"
  const mutedClass = useWhiteLinks ? "text-white/60" : "text-muted-foreground"

  // Match markdown links, @mentions, #channels, @roles, and URLs
  // Order matters: markdown links first to avoid matching bare URLs inside markdown
  const regex = /\[([^\]]+)\]\(([^)]+)\)|<@!?(\d+)>|<#(\d+)>|<@&(\d+)>|(https?:\/\/[^\s<]+)/g
  let match

  while ((match = regex.exec(content)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    if (match[1] && match[2]) {
      // Markdown link [text](url)
      const linkText = match[1]
      const linkUrl = match[2]
      parts.push(
        <a
          key={`markdown-${match.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {linkText}
        </a>,
      )
    } else if (match[3]) {
      // User mention
      const userId = match[3]
      const userData = userMap[userId]
      if (userData) {
        const username = typeof userData === "string" ? userData : userData.username
        const displayName = typeof userData === "string" ? userData : userData.displayName
        parts.push(
          <Link
            key={`user-${match.index}`}
            href={`/members/${username.toLowerCase().replace(/\s+/g, "_")}`}
            className={`${linkClass} font-medium`}
          >
            @{displayName}
          </Link>,
        )
      } else {
        parts.push(
          <span key={`user-${match.index}`} className={mutedClass}>
            @unknown
          </span>,
        )
      }
    } else if (match[4]) {
      // Channel mention
      const channelId = match[4]
      const channelName = channelMap[channelId]
      parts.push(
        <a
          key={`channel-${match.index}`}
          href={`https://discord.com/channels/${guildId}/${channelId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} font-medium`}
        >
          #{channelName || "channel"}
        </a>,
      )
    } else if (match[5]) {
      // Role mention
      parts.push(
        <span key={`role-${match.index}`} className={mutedClass}>
          @role
        </span>,
      )
    } else if (match[6]) {
      // URL
      const url = match[6]
      parts.push(
        <a
          key={`url-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} break-all`}
        >
          {url.length > 50 ? url.substring(0, 50) + "..." : url}
        </a>,
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return <>{parts}</>
}
