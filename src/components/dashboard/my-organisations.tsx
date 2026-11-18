import { Building2 } from "lucide-react"

import { type BotIdentity, callTokenBot } from "@/lib/token-bot"

export type Org = { id: number; name: string; vat: string | null; self?: true; contact?: true }

/**
 * The organisations the member is part of: the company Odoo has them as a contact of, and the ones
 * they added to invoice bookings to (the bot). Their own partner (`self`) isn't one. Nothing when
 * they have none or Odoo can't be reached.
 */
export async function MyOrganisations({ who }: { who: BotIdentity }) {
  const answer = await callTokenBot("orgs", who).catch(() => null)
  return <OrganisationsCard orgs={answer?.body.ok ? ((answer.body as { orgs?: Org[] }).orgs ?? []) : []} />
}

export function OrganisationsCard({ orgs: all }: { orgs: Org[] }) {
  const orgs = all.filter((o) => !o.self)
  if (!orgs.length) return null
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Building2 className="h-5 w-5 text-primary" /> {orgs.length === 1 ? "Your organisation" : "Your organisations"}
      </h3>
      <ul className="mt-2 space-y-1">
        {orgs.map((o) => (
          <li key={o.id} className="text-sm">
            <span className="font-medium text-foreground">{o.name}</span>
            {o.vat && <span className="text-muted-foreground"> · {o.vat}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">You can book and invoice rooms to {orgs.length === 1 ? "it" : "them"}.</p>
    </div>
  )
}
