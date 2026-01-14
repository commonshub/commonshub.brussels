/**
 * Server-side helper to resolve Discord image URLs through the image proxy
 * Use this in server components before passing data to client components
 */

import { getProxiedDiscordImage, getProxiedImageUrl } from "./image-proxy"

interface ImageAttachment {
  id: string
  url: string
  proxyUrl: string
  contentType?: string
}

/**
 * Resolve a single attachment's URL to use the image proxy
 */
export function resolveImageUrl(
  attachment: ImageAttachment,
  timestamp: string,
  messageId?: string,
  channelId?: string
): ImageAttachment {
  // If we have all the metadata, use the new parameter-based proxy API
  if (messageId && channelId) {
    const proxiedUrl = getProxiedDiscordImage(channelId, messageId, attachment.id, timestamp)
    return {
      ...attachment,
      url: proxiedUrl,
      proxyUrl: proxiedUrl,
    }
  }

  // Otherwise fall back to legacy URL-based proxy
  const proxiedUrl = getProxiedImageUrl(attachment.url, { messageId, channelId })
  return {
    ...attachment,
    url: proxiedUrl,
    proxyUrl: proxiedUrl,
  }
}

/**
 * Resolve all attachments in a message to use the image proxy
 */
export function resolveMessageImages<
  T extends { attachments?: ImageAttachment[]; timestamp: string; messageId?: string; channelId?: string }
>(message: T): T {
  if (!message.attachments || message.attachments.length === 0) {
    return message
  }

  return {
    ...message,
    attachments: message.attachments.map((att) =>
      resolveImageUrl(att, message.timestamp, message.messageId, message.channelId)
    ),
  }
}

/**
 * Resolve all attachments in an array of messages
 */
export function resolveMessagesImages<
  T extends { attachments?: ImageAttachment[]; timestamp: string; messageId?: string; channelId?: string }
>(messages: T[]): T[] {
  return messages.map((msg) => resolveMessageImages(msg))
}
