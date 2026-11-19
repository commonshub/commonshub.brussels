import { auth } from "@/auth"
import { ActivateMembership } from "@/components/activate-membership"
import { EmailDashboard } from "@/components/dashboard/email-dashboard"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import { TestDashboard } from "@/components/dashboard/test-dashboard"
import { HomePage } from "@/components/home-page"
import { isAdmin, isMember } from "@/lib/admin-check"
import { findMemberByUsername } from "@/lib/view-as"

/**
 * Members see their dashboard; everyone else the homepage (also at /homepage).
 * Signed in without the member role: the homepage, and a way in for those
 * who already pay (lib/member-activation.ts). A test user (signed in with an
 * email code, in the bot's TEST_LOGIN_EMAILS) gets the test dashboard. A Discord admin can look
 * at another member's dashboard, read-only: /?as=<username>, or at what someone signed in with an
 * email code sees: /?as=<email>.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ paid?: string; as?: string; linked?: string }> }) {
  const params = await searchParams
  const paid = params.paid?.slice(0, 40)
  const session = await auth()
  if (params.as && session?.user && (await isAdmin())) {
    const asEmail = params.as.trim().toLowerCase()
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(asEmail) && asEmail.length <= 200) {
      console.log(`[view-as] ${session.user.username} views the dashboard of an email user`)
      return <EmailDashboard email={asEmail} viewAs={{ by: session.user.username }} />
    }
    const member = await findMemberByUsername(params.as)
    if (member) {
      console.log(`[view-as] ${session.user.username} views the dashboard of ${member.username}`)
      return <MemberDashboard user={member} viewAs={{ by: session.user.username }} />
    }
  }
  if (session?.user?.testMode) return <TestDashboard user={session.user} paid={paid} />
  if (session?.user && (await isMember())) return <MemberDashboard user={session.user} paid={paid} />
  // Signed in with an email code (an Odoo contact, no Discord).
  if (session?.user?.odooPartnerId && session.user.email && !session.user.discordId) return <EmailDashboard email={session.user.email} name={session.user.name} paid={paid} linked={params.linked === "discord"} />
  return (
    <>
      {session?.user?.discordId && <ActivateMembership username={session.user.username} />}
      <HomePage />
    </>
  )
}
