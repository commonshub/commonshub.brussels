"use client"

import { useState } from "react"
import { ArrowRight, Calendar, MapPin } from "lucide-react"

import Image from "@/components/optimized-image"
import { Card } from "@/components/ui/card"
import { formatEventWhen } from "@/lib/event-dates"
import { getProxiedImageUrl } from "@/lib/image-proxy"

export interface FeaturedEvent {
  id: string
  name: string
  description: string
  start_at: string
  end_at: string
  cover_url: string
  url: string
  location?: string
  isExternal: boolean
  externalUrl?: string
  tags?: Array<{ name: string; color: string }>
}

/**
 * A featured event's cover is a square poster, with its own title and date
 * printed on it. Cropped into the wide banner the regular cards use, the
 * poster lost its edges and the date badge sat on top of its text. Here
 * the poster is shown whole, beside the details (stacked on a phone), and
 * nothing is laid over it.
 */
export function FeaturedEventCard({ event, onTagClick }: { event: FeaturedEvent; onTagClick: (tag: string) => void }) {
  const href = event.isExternal ? event.externalUrl : event.url
  const isOwnPage = !!href?.startsWith("/")
  const tags = (event.tags ?? []).filter((tag) => tag.name.toLowerCase() !== "featured")
  const when = formatEventWhen(event.start_at, event.end_at)
  // The cover's own shape, once loaded. Stacked on a phone the frame follows
  // it (a wide banner is not boxed into a tall square); beside the text it
  // stays square so the two featured cards line up.
  const [ratio, setRatio] = useState(1)

  return (
    <a href={href} target={isOwnPage ? undefined : "_blank"} rel={isOwnPage ? undefined : "noopener noreferrer"} className="group block h-full">
      <Card className="flex h-full flex-col gap-0 overflow-hidden py-0 transition-all hover:shadow-lg sm:flex-row">
        <div
          className="relative aspect-[var(--cover-ratio)] w-full shrink-0 overflow-hidden bg-muted sm:aspect-square sm:w-[45%]"
          style={{ "--cover-ratio": ratio } as React.CSSProperties}
        >
          {event.cover_url ? (
            <>
              {/* Covers come in any shape — a square poster, a wide banner.
                  The cover is shown whole (contain), over a blurred copy of
                  itself that fills the frame, so nothing is ever cropped. */}
              <Image
                src={getProxiedImageUrl(event.cover_url, "md", { relative: true })}
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 300px"
                className="scale-110 object-cover opacity-70 blur-2xl"
              />
              <Image
                src={getProxiedImageUrl(event.cover_url, "md", { relative: true })}
                alt={event.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 300px"
                onLoad={(e) => {
                  const img = e.currentTarget
                  // Between square and 2:1: a tall poster stays square, a banner is not a sliver.
                  if (img.naturalWidth && img.naturalHeight) setRatio(Math.min(2, Math.max(1, img.naturalWidth / img.naturalHeight)))
                }}
                className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              <Calendar className="h-12 w-12 text-primary/40" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 sm:p-6">
          {when && (
            <div className="flex items-start gap-2 text-sm font-semibold text-primary">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{when}</span>
            </div>
          )}
          <h3 className="text-xl font-bold leading-tight text-foreground break-words sm:text-2xl">{event.name}</h3>
          {event.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="break-words">{event.location}</span>
            </div>
          )}
          {event.description && <p className="line-clamp-4 text-sm text-muted-foreground break-words">{event.description}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.name}
                  className="cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: tag.color || "#6b7280", color: "#fff" }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onTagClick(tag.name)
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
            {isOwnPage ? "Programme and details" : "Details and RSVP"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </a>
  )
}
