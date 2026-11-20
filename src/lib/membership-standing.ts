/**
 * Where someone stands as a member, from what the site can see: their membership in chb's members
 * list (found by their Discord account or the salted hash of their email), and their application
 * (paid through its payment link: "member", which counts before chb's next members list has it).
 */

import { type Application } from "./membership-application"
import { isApplicationsConfigured, listApplications, loadVouchers } from "./membership-applications-store"
import { findPlan, type MemberPlan } from "./member-plan"

export type Standing = {
  /** member: paid and running; accepted: accepted, not paid; pending: waiting for vouches; ended: a membership that lapsed; none. */
  state: "member" | "accepted" | "pending" | "ended" | "none"
  plan: MemberPlan | null
  application: Application | null
  vouchers: Array<{ name: string }>
}

const RUNNING = new Set(["active", "grace", "trialing", "past_due"])
const UNPAID = new Set(["lapsed", "canceled", "unpaid", "incomplete", "paused"])

export const isRunning = (plan: MemberPlan | null) => !!plan && (RUNNING.has(plan.status) || !!plan.pending)
export const isUnpaid = (plan: MemberPlan | null) => !!plan && !plan.pending && UNPAID.has(plan.status)

export async function membershipStanding(who: { email?: string | null; discordId?: string | null }): Promise<Standing> {
  const email = who.email?.trim().toLowerCase() || null
  const [{ plan }, application] = await Promise.all([
    findPlan({ email, discordId: who.discordId ?? null }).catch(() => ({ plan: null as MemberPlan | null })),
    isApplicationsConfigured()
      ? listApplications()
          .then((all) => all.find((a) => (email && a.email.trim().toLowerCase() === email) || (who.discordId && a.discordId === who.discordId)) ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ])
  const vouchers = !application ? [] : application.vouchers?.length ? application.vouchers : ((await loadVouchers([application.id]).catch(() => new Map())).get(application.id) ?? [])
  const state: Standing["state"] = isRunning(plan)
    ? "member"
    : application?.status === "member" && !isUnpaid(plan)
      ? "member"
      : application?.status === "approved"
        ? "accepted"
        : application?.status === "pending"
          ? "pending"
          : plan
            ? "ended"
            : "none"
  return { state, plan, application, vouchers }
}
