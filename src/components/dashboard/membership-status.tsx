import Link from "next/link"
import { BadgeCheck, Hourglass, UserPlus } from "lucide-react"

import { paymentUrlFor, VOUCHES_NEEDED, type Application } from "@/lib/membership-application"
import { isApplicationsConfigured, listApplications, loadVouchers } from "@/lib/membership-applications-store"
import { findPlan } from "@/lib/member-plan"

const ACTIVE = new Set(["active", "grace", "trialing", "past_due"])
const BUTTON = "mt-3 flex w-fit rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"

const names = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : (list[0] ?? ""))

/**
 * Where someone signed in with an email code stands as a member: a member (a running membership
 * paid with that address), accepted but not paid yet (with who vouched and the payment link),
 * waiting for vouches, or not a member yet (and how to become one).
 */
export async function MembershipStatus({ email, viewAs }: { email: string; viewAs?: boolean }) {
  const [{ plan }, application] = await Promise.all([
    findPlan({ email }).catch(() => ({ plan: null })),
    isApplicationsConfigured()
      ? listApplications()
          .then((all) => all.find((a) => a.email.trim().toLowerCase() === email.toLowerCase()) ?? null)
          .catch(() => null)
      : Promise.resolve(null as Application | null),
  ])
  const who = viewAs ? "They" : "You"

  if (plan && ACTIVE.has(plan.status)) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> {who === "You" ? "You're" : "They're"} a member of the Commons Hub.
      </p>
    )
  }

  if (application?.status === "approved" || application?.status === "pending") {
    const vouchers = application.vouchers?.length ? application.vouchers : ((await loadVouchers([application.id]).catch(() => new Map())).get(application.id) ?? [])
    const vouched = names(vouchers.map((v: { name: string }) => v.name))
    if (application.status === "approved")
      return (
        <Card icon={<BadgeCheck className="h-6 w-6 shrink-0 text-primary" />} title={viewAs ? "Accepted, not paid yet" : "You've been accepted: one last step"}>
          {vouched ? `${vouched} vouched for ${viewAs ? "them" : "you"}. ` : ""}
          {viewAs ? "They become a member once they pay their membership fee." : "You become a member as soon as you pay your membership fee: it's what keeps the hub open."}
          {!viewAs && (
            <a href={paymentUrlFor(application)} className={BUTTON}>
              Pay my membership
            </a>
          )}
        </Card>
      )
    return (
      <Card icon={<Hourglass className="h-6 w-6 shrink-0 text-primary" />} title={viewAs ? "Application waiting for vouches" : "Your application is in"}>
        {vouchers.length} of {VOUCHES_NEEDED} vouches so far{vouched ? ` (${vouched})` : ""}. {viewAs ? "They're" : "You're"} accepted once {VOUCHES_NEEDED} members vouch.
      </Card>
    )
  }

  return (
    <Card icon={<UserPlus className="h-6 w-6 shrink-0 text-primary" />} title={viewAs ? "Not a member yet" : "You are not a member yet"}>
      {plan ? `${viewAs ? "Their" : "Your"} membership has ended. ` : ""}
      Members get the door code, coworking with tokens and a say in how the hub runs. You can still book rooms and coworking here.
      {!viewAs && (
        <Link href="/membership" className={BUTTON}>
          Become a member
        </Link>
      )}
    </Card>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-5">
      {icon}
      <div className="min-w-0">
        <p className="font-bold text-foreground">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}
