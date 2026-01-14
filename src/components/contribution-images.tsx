"use client"

import { ImageLightbox } from "./image-lightbox"

interface ImageData {
  url: string
  proxyUrl: string
  id: string
  timestamp: string
  messageId: string
  channelId?: string
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>
  message: string
  author?: {
    id: string
    username: string
    displayName: string
    avatar: string | null
  }
}

interface ContributionImagesProps {
  images?: string[]
  attachments?: Array<{ url: string; proxyUrl: string; contentType?: string }>
  imageData?: ImageData[]
  layout?: "wrap" | "scroll"
  userMap?: Record<string, string | { username: string; displayName: string }>
  channelMap?: Record<string, string>
  guildId?: string
}

export function ContributionImages({
  images,
  attachments,
  imageData,
  layout = "wrap",
  userMap,
  channelMap,
  guildId,
}: ContributionImagesProps) {
  // Use new imageData format if available, otherwise fall back to old formats
  const imageList = imageData
    ? imageData.map((data) => ({
        url: data.url,
        thumbnailUrl: data.proxyUrl || data.url,
        attachmentId: data.id,
        timestamp: data.timestamp,
        messageId: data.messageId,
        channelId: data.channelId,
        reactions: data.reactions,
        caption: data.message,
        author: data.author,
      }))
    : images
    ? images.map((url) => ({ url, thumbnailUrl: url }))
    : (attachments || []).map((attachment) => ({
        url: attachment.url,
        thumbnailUrl: attachment.proxyUrl || attachment.url,
      }))

  if (imageList.length === 0) return null

  return (
    <ImageLightbox
      images={imageList}
      thumbnailSize="md"
      layout={layout}
      userMap={userMap}
      channelMap={channelMap}
      guildId={guildId}
    />
  )
}
