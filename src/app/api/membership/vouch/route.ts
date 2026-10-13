import { NextResponse } from "next/server"

import { isMember } from "@/lib/admin-check"
import { approveIfVouched } from "@/lib/membership-applications-store"

export const dynamic = "force-dynamic"

/**
 * After a member published their vouch (signed with their own key, on the
 * relays): count the vouches again, and approve the application at three.
 * The count comes from the relays, never from this request.
 */
export async function POST(request: Request) {
  if (!(await isMember())) return NextResponse.json({ error: "Members only" }, { status: 403 })
  const { id } = ((await request.json().catch(() => ({}))) ?? {}) as { id?: unknown }
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  try {
    const result = await approveIfVouched(id)
    if (!result) return NextResponse.json({ error: "No such application" }, { status: 404 })
    return NextResponse.json({ ok: true, status: result.status, vouchers: result.vouchers.map((v) => v.name) })
  } catch (error) {
    console.error("[membership] vouch check failed:", error)
    return NextResponse.json({ error: "Could not check the vouches, please try again" }, { status: 502 })
  }
}
