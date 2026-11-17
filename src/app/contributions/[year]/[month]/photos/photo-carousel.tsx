"use client"

import { useEffect, useRef } from "react"

import Image from "@/components/optimized-image"
import { ImageLightbox, type ImageLightboxHandle } from "@/components/image-lightbox"
import type { ContributionPhoto } from "@/lib/contribution-photos"

/** The month's photos as a grid; the one in ?image= opens full screen on arrival (swipe, arrows). */
export function PhotoCarousel({ photos, initialId }: { photos: ContributionPhoto[]; initialId: string | null }) {
  const lightbox = useRef<ImageLightboxHandle>(null)
  useEffect(() => {
    const i = initialId ? photos.findIndex((p) => p.id === initialId) : -1
    if (i >= 0) lightbox.current?.openLightbox(i)
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => lightbox.current?.openLightbox(i)} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            <Image src={p.url} alt={p.caption || `Shared by ${p.author.displayName}`} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
          </button>
        ))}
      </div>
      <ImageLightbox
        ref={lightbox}
        images={photos.map((p) => ({ url: p.url, caption: p.caption, author: p.author, timestamp: p.timestamp, attachmentId: p.id }))}
        showThumbnails={false}
      />
    </>
  )
}
