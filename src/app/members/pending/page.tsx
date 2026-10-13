import type { Metadata } from "next"

import { auth } from "@/auth"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { PendingApplications } from "@/components/membership/pending-applications"
import { isMember } from "@/lib/admin-check"
import { VOUCHES_NEEDED, withoutEmail } from "@/lib/membership-application"
import { hasTokens, isApplicationsConfigured, listApplications, loadVouchers } from "@/lib/membership-applications-store"
import { COMMUNITY, RELAYS, siteIdentity } from "@/lib/nostr-server"

// Reads the relays and the session at request time.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pending applications | Commons Hub Brussels",
  description: "Membership applications waiting for members to vouch for them.",
  robots: { index: false },
}

/**
 * /members/pending: the membership applications, for members only (no
 * email addresses). Members holding tokens vouch for someone; at three
 * vouches the application is approved and the applicant gets the payment
 * link.
 */
export default async function PendingApplicationsPage() {
  const session = await auth()
  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-28">
      <h1 className="text-3xl font-bold text-foreground">Pending applications</h1>
      <p className="mb-6 mt-2 text-muted-foreground">
        People who applied to become members. Members with tokens can vouch for someone they know or met at the hub: at {VOUCHES_NEEDED} vouches, they’re accepted and receive the payment link.
      </p>
      {children}
    </div>
  )
  if (!session?.user) return shell(<SignInPrompt>Sign in with Discord to see the pending applications.</SignInPrompt>)
  if (!(await isMember())) return shell(<p className="text-muted-foreground">This page is for members only.</p>)
  if (!isApplicationsConfigured()) return shell(<p className="text-muted-foreground">Applications are not available right now.</p>)

  const all = await listApplications()
  const recentMs = Date.now() - 30 * 86_400_000
  const shown = all.filter((a) => a.status === "pending" || Date.parse(a.approvedAt ?? a.submittedAt) > recentMs)
  const vouchers = await loadVouchers(shown.filter((a) => a.status === "pending").map((a) => a.id))
  const site = siteIdentity()!
  return shell(
    <PendingApplications
      applications={shown.map((a) => ({ ...withoutEmail(a), vouchedBy: a.status === "pending" ? (vouchers.get(a.id) ?? []) : (a.vouchers ?? []) }))}
      me={session.user.discordId}
      canVouch={await hasTokens(session.user.discordId)}
      needed={VOUCHES_NEEDED}
      sitePubkey={site.pubkey}
      community={COMMUNITY}
      relays={RELAYS}
    />,
  )
}
