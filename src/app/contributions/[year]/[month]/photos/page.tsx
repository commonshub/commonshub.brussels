import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { isMember } from "@/lib/admin-check"
import { contributionPhotos } from "@/lib/contribution-photos"
import { verifySettingsLink } from "@/lib/notification-links"
import { PhotoCarousel } from "./photo-carousel"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Contributions | Commons Hub Brussels", robots: { index: false } }

/**
 * /contributions/YYYY/MM/photos?image=<id>: what members shared in #contributions that month, full
 * screen, swipe left and right. The recap emails' mosaic links here, opening on the photo tapped.
 * The messages show for members, and for whoever opens a recap's link (t= is their signed token).
 */
export default async function ContributionPhotosPage({ params, searchParams }: { params: Promise<{ year: string; month: string }>; searchParams: Promise<{ image?: string; t?: string }> }) {
  const { year, month } = await params
  const { image, t } = await searchParams
  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) notFound()
  const withCaptions = (t ? !!verifySettingsLink(t) : false) || (await isMember())
  const photos = contributionPhotos(year, month, { withCaptions })
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-foreground">Contributions, {name}</h1>
      <p className="mt-1 text-muted-foreground">What members did for the hub, shared in #contributions. Tap a photo to see it full screen.</p>
      {photos.length ? <PhotoCarousel photos={photos} initialId={image ?? null} /> : <p className="mt-6 text-muted-foreground">No photos this month.</p>}
      <Link href={`/contributions/${year}/${month}`} className="mt-8 inline-block text-primary underline underline-offset-2">
        The rest of {name}
      </Link>
    </div>
  )
}
