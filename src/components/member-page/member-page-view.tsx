import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { auth } from "@/auth"
import { isMember, isSteward } from "@/lib/admin-check"
import { sandboxBase, type MemberPage } from "@/lib/member-pages"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { MemberPageFrame, type Viewer } from "./member-page-frame"

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" })

/** A member's page: a thin header (title, author, date) above the sandboxed frame. */
export async function MemberPageView({ page }: { page: MemberPage }) {
  const session = await auth()
  const user = session?.user as { username?: string; name?: string | null } | undefined
  const member = await isMember()
  const viewer: Viewer = {
    signedIn: !!user,
    ...(user ? { username: user.username, displayName: user.name ?? user.username } : {}),
    member,
    steward: member ? await isSteward() : false,
  }

  if (page.visibility !== "public" && !member) {
    return (
      <div className="min-h-screen pt-28 pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-3xl font-bold">{page.title}</h1>
          <p className="mt-2 text-muted-foreground">
            A page by{" "}
            <Link href={`/members/${page.username}`} className="underline underline-offset-2">
              @{page.username}
            </Link>
            , for members of the Commons Hub.
          </p>
          <div className="mt-6">
            <SignInPrompt>{user ? "This page is for members only." : "Log in with Discord to see it."}</SignInPrompt>
          </div>
        </div>
      </div>
    )
  }

  const src = sandboxBase(page)
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-2 pb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{page.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              By{" "}
              <Link href={`/members/${page.username}`} className="underline underline-offset-2">
                @{page.username}
              </Link>{" "}
              · {day(page.updatedAt)}
              {page.visibility !== "public" ? " · members only" : ""}
            </p>
            {page.description && <p className="mt-2 max-w-3xl text-muted-foreground">{page.description}</p>}
          </div>
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Full screen <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <MemberPageFrame src={src} title={page.title} viewer={viewer} />
        </div>
      </div>
    </div>
  )
}
