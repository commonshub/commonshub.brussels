import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { auth } from "@/auth"
import { AddEmailCard } from "@/components/dashboard/add-email"
import { isMember } from "@/lib/admin-check"
import { findPlan } from "@/lib/member-plan"
import { DiscordSignInButton } from "./sign-in-button"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Link your Discord account | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * /link-discord, from the recap email of a member chb doesn't know on Discord. The link carries
 * nothing: a forwarded email gives nobody anything. Signed in with Discord, a membership under
 * the Discord account's email is found by itself (lib/discord-links.ts records it at login);
 * otherwise they confirm the address they pay with, by a code mailed to it (/api/members/email,
 * the dashboard's own flow), which links it, and gives the member role when they lacked it.
 */
export default async function LinkDiscordPage() {
  const session = await auth()
  const user = session?.user
  let body: React.ReactNode
  if (!user?.discordId) {
    body = (
      <>
        <p className="mt-3 text-muted-foreground">Sign in with your Discord account, then confirm the email address you pay your membership with. Your next recap will show the days you came, the tokens you earned and spent, and the thank-yous you got.</p>
        <div className="mt-6">
          <DiscordSignInButton />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No Discord account yet? Join us on{" "}
          <a href="https://discord.commonshub.brussels" className="text-primary underline">
            the Commons Hub Discord
          </a>
          , then come back to this page.
        </p>
      </>
    )
  } else {
    const member = await isMember()
    const { plan } = member ? await findPlan(user) : { plan: null }
    body = plan ? (
      <>
        <p className="mt-3 flex items-center gap-2 text-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400" aria-hidden /> Your Discord account ({user.username}) is linked to your membership.
        </p>
        <Link href="/" className="mt-6 inline-block text-primary underline underline-offset-2">
          Go to your dashboard
        </Link>
      </>
    ) : (
      <div className="mt-6">
        <AddEmailCard variant={member ? "membership" : "activate"} />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-24">
      <h1 className="text-3xl font-extrabold text-foreground">Link your Discord account</h1>
      {body}
    </div>
  )
}
