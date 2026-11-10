import { auth } from "@/auth"
import { ActivateMembership } from "@/components/activate-membership"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import { HomePage } from "@/components/home-page"
import { isMember } from "@/lib/admin-check"

/**
 * Members see their dashboard; everyone else the homepage (also at /homepage).
 * Signed in without the member role: the homepage, and a way in for those
 * who already pay (lib/member-activation.ts).
 */
export default async function Page() {
  const session = await auth()
  if (session?.user && (await isMember())) return <MemberDashboard user={session.user} />
  return (
    <>
      {session?.user?.discordId && <ActivateMembership username={session.user.username} />}
      <HomePage />
    </>
  )
}
