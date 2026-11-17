import { auth } from "@/auth"
import { ActivateMembership } from "@/components/activate-membership"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import { TestDashboard } from "@/components/dashboard/test-dashboard"
import { HomePage } from "@/components/home-page"
import { isMember } from "@/lib/admin-check"

/**
 * Members see their dashboard; everyone else the homepage (also at /homepage).
 * Signed in without the member role: the homepage, and a way in for those
 * who already pay (lib/member-activation.ts). A test user (signed in with an
 * email code, in the bot's TEST_LOGIN_EMAILS) gets the test dashboard.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const paid = (await searchParams).paid?.slice(0, 40)
  const session = await auth()
  if (session?.user?.testMode) return <TestDashboard user={session.user} paid={paid} />
  if (session?.user && (await isMember())) return <MemberDashboard user={session.user} paid={paid} />
  return (
    <>
      {session?.user?.discordId && <ActivateMembership username={session.user.username} />}
      <HomePage />
    </>
  )
}
