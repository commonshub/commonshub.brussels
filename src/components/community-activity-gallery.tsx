"use client";

import { useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ImageLightbox, ImageLightboxHandle } from "./image-lightbox";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import settings from "@/settings/settings.json";

interface ActivityImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  author: {
    displayName: string;
    avatar: string | null;
  };
  caption: string;
  timestamp: string;
}

interface CommunityActivityGalleryProps {
  channelId: string;
  title?: string;
  maxImages?: number;
  layout?: "grid" | "horizontal";
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function CommunityActivityGallery({
  channelId,
  title,
  maxImages = 6,
  layout = "grid",
}: CommunityActivityGalleryProps) {
  const lightboxRef = useRef<ImageLightboxHandle>(null);
  const searchParams = useSearchParams();

  // Fetch from static JSON file
  const { data } = useSWR<{
    images: Array<{
      filePath: string;
      id: string;
      author: {
        id: string;
        username: string;
        displayName: string;
        avatar: string | null;
      };
      message: string;
      timestamp: string;
      messageId: string;
      channelId: string;
    }>;
  }>(`/data/latest/discord/${channelId}/images.json`, fetcher);

  console.log(
    ">>> Loading image: ",
    `/data/latest/discord/${channelId}/images.json`,
    data?.images?.[0]?.filePath
  );
  // Map images to ActivityImage format
  const allImages: ActivityImage[] = (data?.images || []).map((image) => ({
    id: image.id,
    // Use regular image proxy with local data path for better performance
    // Use relative URLs for client-side rendering to work on any port
    imageUrl: getProxiedImageUrl(image.filePath, "lg", { relative: true }),
    thumbnailUrl: getProxiedImageUrl(image.filePath, "sm", { relative: true }),
    author: {
      displayName: image.author.displayName || image.author.username,
      avatar: image.author.avatar
        ? `https://cdn.discordapp.com/avatars/${image.author.id}/${image.author.avatar}.png`
        : null,
    },
    caption: image.message,
    timestamp: image.timestamp,
  }));

  const images = allImages.slice(0, maxImages);
  const hasImages = images.length > 0;

  const openLightbox = useCallback((index: number) => {
    lightboxRef.current?.openLightbox(index);
  }, []);

  // Check if URL has an image parameter and open that image
  // Use a ref to track if we've already opened this image to prevent loops
  const lastOpenedImageId = useRef<string | null>(null);

  useEffect(() => {
    const imageId = searchParams.get("image");

    // Only open if we have images, there's an imageId, and it's different from last opened
    if (imageId && hasImages && imageId !== lastOpenedImageId.current) {
      const imageIndex = images.findIndex((img) => img.id === imageId);
      if (imageIndex !== -1) {
        lastOpenedImageId.current = imageId;
        openLightbox(imageIndex);
      }
    } else if (!imageId) {
      // Clear the ref when there's no image in URL (lightbox closed)
      lastOpenedImageId.current = null;
    }
  }, [searchParams, images, hasImages, openLightbox]);

  if (!hasImages) {
    return null;
  }

  // Convert to ImageLightbox format - need to find the original data to get IDs
  const lightboxImages = images.map((image) => {
    const originalImage = data?.images.find((img) => img.id === image.id);
    return {
      url: image.imageUrl,
      thumbnailUrl: image.thumbnailUrl || image.imageUrl,
      caption: image.caption,
      author: {
        id: originalImage?.author.id || "",
        displayName: image.author.displayName,
        avatar: image.author.avatar,
      },
      timestamp: image.timestamp,
      attachmentId: image.id,
      messageId: originalImage?.messageId || "",
      channelId: channelId,
    };
  });

  return (
    <>
      <div
        className={
          layout === "horizontal"
            ? "flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            : "grid grid-cols-2 md:grid-cols-3 gap-4"
        }
      >
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => openLightbox(index)}
            className={`relative rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
              layout === "horizontal" ? "w-48 h-48 shrink-0" : "aspect-square"
            }`}
          >
            <Image
              src={image.thumbnailUrl || image.imageUrl}
              alt={image.caption || "Community activity photo"}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes={
                layout === "horizontal"
                  ? "192px"
                  : "(max-width: 768px) 50vw, 33vw"
              }
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </button>
        ))}
      </div>

      <ImageLightbox
        ref={lightboxRef}
        images={lightboxImages}
        layout="wrap"
        showThumbnails={false}
        guildId={settings.discord.guildId}
      />
    </>
  );
}
