import { auth } from "@/auth"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import { HomePage } from "@/components/home-page"
import { isMember } from "@/lib/admin-check"

/** Members see their dashboard; everyone else the homepage (also at /homepage). */
export default async function Page() {
  const session = await auth()
  if (session?.user && (await isMember())) return <MemberDashboard user={session.user} />
  return <HomePage />
}
