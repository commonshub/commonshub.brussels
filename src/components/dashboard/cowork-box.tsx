import { Laptop } from "lucide-react"

import { ActionToggle } from "@/components/dashboard/action-toggle"
import { HubBookingButton } from "@/components/dashboard/hub-booking"
import { type BotIdentity, callTokenBot } from "@/lib/token-bot"

const ACTION = "inline-flex rounded-full border-2 border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/Brussels" })

type Sub = { name: string; since: string | null; nextInvoice: string | null; monthly: number }

/**
 * The dashboard's coworking box. With unlimited coworking (a running subscription in Odoo, made
 * here or by hand) there's no pass to buy: it says so, and only a pass for a guest is left (for
 * members, paid in tokens). Otherwise: a pass for today, one for a guest, or unlimited coworking at
 * €100 a month + VAT.
 */
export async function CoworkBox({ who, text, guest, disabled }: { who: BotIdentity; text: string; guest: boolean; disabled?: boolean }) {
  const a = await callTokenBot("account", who).catch(() => null)
  const sub = a?.body.ok ? ((a.body as { coworkSubscription?: Sub | null }).coworkSubscription ?? null) : null
  if (sub)
    return (
      <ActionToggle
        icon={<Laptop className="h-6 w-6 text-primary" />}
        title="Cowork"
        disabled={disabled}
        text={`You have unlimited coworking (${sub.name}${sub.nextInvoice ? `, next invoice on ${day(sub.nextInvoice)}` : ""}): just come in.${guest ? " Bring someone along with a guest pass." : ""}`}
      >
        {guest && (
          <HubBookingButton mode="cowork-guest" className={ACTION}>
            For a guest
          </HubBookingButton>
        )}
      </ActionToggle>
    )
  return (
    <ActionToggle icon={<Laptop className="h-6 w-6 text-primary" />} title="Cowork" text={text} disabled={disabled}>
      <HubBookingButton mode="cowork-me" className={ACTION}>
        For me, today
      </HubBookingButton>
      {guest && (
        <HubBookingButton mode="cowork-guest" className={ACTION}>
          For a guest
        </HubBookingButton>
      )}
      <HubBookingButton mode="cowork-monthly" className={ACTION}>
        Unlimited · €100/month + VAT
      </HubBookingButton>
    </ActionToggle>
  )
}
