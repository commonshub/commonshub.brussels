import type { DonorsSummary } from "@/lib/donors"

/**
 * The people and organisations who already gave. Names are shown to
 * members only (see lib/donors.ts); everyone else sees how many donations
 * the space has received.
 */
export function Donors({ donors, member }: { donors: DonorsSummary; member: boolean }) {
  if (donors.donations === 0) return null
  if (!member || donors.names.length === 0) {
    return (
      <p className="mt-6 text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{donors.donations}</span> donations so far, from people and
        organisations who made this space theirs.
      </p>
    )
  }
  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        Thank you to the {donors.names.length} people and organisations who already contributed:
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{donors.names.join(" · ")}</p>
    </div>
  )
}
