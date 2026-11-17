import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { auth } from "@/auth"
import { recordLoginLink } from "@/lib/discord-links"
import { verifyDiscordLinkToken } from "@/lib/notification-links"
import { DiscordSignInButton } from "./sign-in-button"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Link your Discord account | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * /link-discord?t=…: from the recap email of a member chb doesn't know on
 * Discord. The token carries their membership id (emailHash, signed: the link
 * went to that address). Signed in with Discord, we record that this Discord
 * account goes with that membership (lib/discord-links.ts), which chb reads:
 * their next recap is their own.
 */
export default async function LinkDiscordPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const emailHash = t ? verifyDiscordLinkToken(t) : null
  const session = await auth()
  const discordId = session?.user?.discordId

  let body: React.ReactNode
  if (!emailHash) {
    body = <p className="mt-3 text-muted-foreground">This link has expired or isn&apos;t valid. Sign in with Discord on the homepage: if it&apos;s the address you pay your membership with, we&apos;ll link it.</p>
  } else if (!discordId) {
    body = (
      <>
        <p className="mt-3 text-muted-foreground">Sign in with your Discord account and we&apos;ll link it to your membership. Your next recap will show the days you came, the tokens you earned and spent, and the thank-yous you got.</p>
        <div className="mt-6">
          <DiscordSignInButton />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No Discord account yet? Join us on{" "}
          <a href="https://discord.commonshub.brussels" className="text-primary underline">
            the Commons Hub Discord
          </a>
          , then come back to this link.
        </p>
      </>
    )
  } else {
    const ok = await recordLoginLink(discordId, emailHash, new Date(), "email")
    body = ok ? (
      <>
        <p className="mt-3 flex items-center gap-2 text-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400" aria-hidden /> Your Discord account ({session?.user?.username}) is now linked to your membership.
        </p>
        <Link href="/" className="mt-6 inline-block text-primary underline underline-offset-2">
          Go to your dashboard
        </Link>
      </>
    ) : (
      <p className="mt-3 text-destructive">We couldn&apos;t save the link right now. Please try this link again in a minute.</p>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-24">
      <h1 className="text-3xl font-extrabold text-foreground">Link your Discord account</h1>
      {body}
    </div>
  )
}
