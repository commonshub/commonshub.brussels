import { redirect } from "next/navigation"

import { HANDBOOK_URL } from "@/lib/handbook"

/** /handbook: the address to share for the Commons Hub Handbook (on Notion for now, see lib/handbook.ts). */
export default function HandbookPage() {
  redirect(HANDBOOK_URL)
}
