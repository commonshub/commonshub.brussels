import Link from "next/link"

import type { DonorsSummary } from "@/lib/donors"

const LATEST = 10
const LARGEST = 20

function Names({ names }: { names: string[] }) {
  return <>{names.join(" · ")}</>
}

/**
 * Who already contributed, in three short paragraphs: the latest donors,
 * the largest ones of all time (the first twenty, then "show more"), and
 * the lenders from the /debt ledger. Donor names are shown to members only
 * (see lib/donors.ts); lenders are public on /debt already.
 */
export function Donors({ donors, member, lenders }: { donors: DonorsSummary; member: boolean; lenders: string[] }) {
  const named = member && donors.largest.length > 0
  const rest = donors.largest.slice(LARGEST)

  return (
    <div className="mt-6 flex flex-col gap-3 text-sm leading-relaxed">
      {named ? (
        <>
          <p>
            <span className="font-semibold text-foreground">Latest donors: </span>
            <span className="text-muted-foreground">
              <Names names={donors.latest.slice(0, LATEST).map((d) => d.name)} />
            </span>
          </p>
          <div>
            <span className="font-semibold text-foreground">All time largest donors: </span>
            <span className="text-muted-foreground">
              <Names names={donors.largest.slice(0, LARGEST).map((d) => d.name)} />
            </span>
            {rest.length > 0 && (
              <details className="group inline">
                <summary className="ml-1 inline cursor-pointer list-none font-medium text-primary group-open:hidden">
                  show {rest.length} more
                </summary>
                <span className="text-muted-foreground">
                  {" · "}
                  <Names names={rest.map((d) => d.name)} />
                </span>
              </details>
            )}
          </div>
        </>
      ) : (
        donors.donations > 0 && (
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{donors.donations}</span> donations so far, from people and
            organisations who made this space theirs.
          </p>
        )
      )}
      {lenders.length > 0 && (
        <p>
          <span className="font-semibold text-foreground">Lenders: </span>
          <span className="text-muted-foreground">
            <Names names={lenders} />
          </span>{" "}
          <Link href="/debt" className="whitespace-nowrap font-medium text-primary underline-offset-2 hover:underline">
            See the loans →
          </Link>
        </p>
      )}
    </div>
  )
}
