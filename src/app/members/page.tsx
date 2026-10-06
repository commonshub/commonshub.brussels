import type { Metadata } from "next"

import MemberListPage from "./members-list"

export const metadata: Metadata = {
  title: "Members | Commons Hub Brussels",
  description: "The members of the Commons Hub Brussels: how many we are, by plan. Members who are signed in also see who the members are.",
}

/**
 * /members: everyone who keeps the hub going with a membership, by card
 * (Stripe) or by bank transfer. The counts are public; the names are only
 * served to members who are signed in (the API reads the viewer's tier).
 */
export default function MembersPage() {
  return <MemberListPage />
}
