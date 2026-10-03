"use client"

import { useState, useCallback, useRef } from "react"
import Image from "@/components/optimized-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DiscordMessage } from "./discord-message"
import { ImageLightbox, ImageLightboxHandle } from "./image-lightbox"
import { getProxiedImageUrl } from "@/lib/image-proxy"

interface ImagePost {
  imageUrl: string
  author: {
    id: string
    displayName: string
    avatar: string | null
  }
  message: string
  timestamp: string
  messageId?: string
  channelId?: string
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>
  attachmentId?: string
}

interface DiscordImageGalleryProps {
  images: ImagePost[]
  showMessage?: boolean
  thumbnailSize?: "sm" | "md" | "lg"
  userMap?: Record<string, { username: string; displayName: string } | string>
  channelMap?: Record<string, string>
  guildId?: string
}


// Largest proxy size a thumbnail may ask for: the loader picks a size from
// the `sizes` hint and the screen, never above this (a cell is at most ~640px
// on a 2x screen in the largest grid).
const thumbnailMaxSize = { sm: "xs", md: "sm", lg: "sm" } as const

const thumbnailSizeClasses = {
  sm: "grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  md: "grid-cols-3 md:grid-cols-6",
  lg: "grid-cols-2 md:grid-cols-4",
}

export function DiscordImageGallery({
  images,
  showMessage = false,
  thumbnailSize = "md",
  userMap = {},
  channelMap = {},
  guildId = "",
}: DiscordImageGalleryProps) {
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())
  const lightboxRef = useRef<ImageLightboxHandle>(null)

  const handleImageError = useCallback((url: string) => {
    console.log(`Failed to load image:`, url)
    setFailedImageUrls((prev) => {
      if (prev.has(url)) return prev // Already tracked, prevent re-render
      const newSet = new Set(prev)
      newSet.add(url)
      return newSet
    })
  }, [])

  // Filter out failed images by URL
  const validImages = images.filter((post) => !failedImageUrls.has(post.imageUrl))

  // Convert to ImageLightbox format
  const lightboxImages = validImages.map((post) => ({
    url: post.imageUrl,
    thumbnailUrl: post.imageUrl,
    caption: showMessage ? post.message : undefined,
    author: showMessage ? post.author : undefined,
    messageId: post.messageId,
    channelId: post.channelId,
    reactions: post.reactions,
    timestamp: post.timestamp,
    attachmentId: post.attachmentId,
  }))

  return (
    <>
      <div className={`grid ${thumbnailSizeClasses[thumbnailSize]} gap-2`}>
        {validImages.map((post, index) => (
          <div
            key={index}
            className="aspect-square relative rounded-lg overflow-hidden bg-muted cursor-pointer group"
            onClick={() => lightboxRef.current?.openLightbox(index)}
          >
            <Image
              src={getProxiedImageUrl(post.imageUrl, thumbnailMaxSize[thumbnailSize], { relative: true }) || "/placeholder.svg"}
              alt={`Contribution by ${post.author.displayName}`}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
              sizes={
                thumbnailSize === "sm"
                  ? "(max-width: 768px) 25vw, 12.5vw"
                  : thumbnailSize === "md"
                  ? "(max-width: 768px) 33vw, 16vw"
                  : "(max-width: 768px) 50vw, 25vw"
              }
              onError={() => handleImageError(post.imageUrl)}
            />
            {showMessage && thumbnailSize !== "sm" && (
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={post.author.avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {post.author.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white text-sm font-semibold truncate">{post.author.displayName}</span>
                </div>
                {post.message && (
                  <div className="text-white text-xs line-clamp-3 leading-snug">
                    <DiscordMessage
                      content={post.message}
                      userMap={userMap}
                      channelMap={channelMap}
                      guildId={guildId}
                      className="text-white"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <ImageLightbox
        ref={lightboxRef}
        images={lightboxImages}
        thumbnailSize={thumbnailSize}
        layout="wrap"
        showThumbnails={false}
        userMap={userMap}
        channelMap={channelMap}
        guildId={guildId}
      />
    </>
  )
}
