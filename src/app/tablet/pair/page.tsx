import type { Metadata } from "next"

import { auth } from "@/auth"
import { PairApprove } from "@/components/tablet/pair-approve"
import { isSteward } from "@/lib/admin-check"
import { findPairing } from "@/lib/tablet-pairing"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pair the hub's tablet | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * Opened on a steward's phone, from the QR code the hub's tablet shows (or
 * by typing the 6-digit code): approve, and the tablet is trusted with
 * members-only data. Nobody signs in on the tablet itself.
 */
export default async function TabletPairPage({ searchParams }: { searchParams: Promise<{ id?: string; code?: string }> }) {
  const { id, code } = await searchParams
  const session = await auth()
  const steward = session?.user ? await isSteward() : false
  const pairing = id ? findPairing({ id }) : null
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-28">
      <h1 className="text-2xl font-bold text-foreground">Pair the hub&apos;s tablet</h1>
      <p className="mt-2 text-muted-foreground">
        A paired tablet shows booking names and people&apos;s introductions, which only members can see. Only pair the tablet that stays in the hub.
      </p>
      <PairApprove signedIn={!!session?.user} steward={steward} id={pairing ? id : undefined} code={pairing?.code ?? code} expired={!!id && !pairing} />
    </div>
  )
}
