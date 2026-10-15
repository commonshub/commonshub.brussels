import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPage } from "@/lib/member-pages"
import { pageSegment } from "@/lib/member-pages-bridge"
import { MemberPageView } from "@/components/member-page/member-page-view"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ username: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params
  const page = getPage(username.toLowerCase(), pageSegment(slug).slug)
  if (!page) return {}
  return {
    title: `${page.title} | Commons Hub Brussels`,
    description: page.visibility === "public" ? page.description : `A page by @${page.username}, for members of the Commons Hub.`,
  }
}

/** A page a member published (lib/member-pages.ts); <slug>.html shows it full screen. */
export default async function MemberPageRoute({ params }: Props) {
  const { username, slug: segment } = await params
  const { slug, fullScreen } = pageSegment(segment)
  const page = getPage(username.toLowerCase(), slug)
  if (!page) notFound()
  return <MemberPageView page={page} fullScreen={fullScreen} />
}
