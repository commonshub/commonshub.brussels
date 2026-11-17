import { CheckCircle2, Clock, Laptop, Presentation } from "lucide-react"

import { payLaterUrl } from "@/lib/invoice-payment"
import { type BotIdentity, callTokenBot } from "@/lib/token-bot"

type MyBooking = ({ kind: "room"; label: string; start: string; end: string; guest?: string } | { kind: "cowork"; label: string; date: string }) & {
  invoice: { id: number; number: string; total: number; communication: string }
  status: "paid" | "partial" | "pending"
}

const TZ = "Europe/Brussels"
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n)
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })
const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })

function when(b: MyBooking, now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ })
  if (b.kind === "cowork") return b.date === today ? "Today" : day(new Date(`${b.date}T12:00:00Z`))
  const start = new Date(b.start)
  const startDay = start.toLocaleDateString("en-CA", { timeZone: TZ })
  return `${startDay === today ? "Today" : day(start)}, ${hm(start)}–${hm(new Date(b.end))}`
}

/**
 * The member's upcoming bookings paid in euros (from the bot: rooms not over yet, coworking passes
 * from today), each paid or pending payment with a link to pay by bank transfer. `paid`: the
 * invoice number Stripe Checkout just came back with.
 */
export async function MyBookings({ who, paid }: { who: BotIdentity; paid?: string }) {
  const answer = await callTokenBot("mine", who).catch(() => null)
  const bookings = answer?.body.ok ? ((answer.body as { bookings?: MyBooking[] }).bookings ?? []) : []
  if (!bookings.length && !paid) return null
  return (
    <section className="mt-4 rounded-2xl border border-border p-5" aria-labelledby="my-bookings">
      <h2 id="my-bookings" className="text-lg font-bold text-foreground">
        Your bookings
      </h2>
      {paid && (
        <p className="mt-2 flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Paid, thank you{paid ? `: invoice ${paid}` : ""}. Stripe emails you a receipt.
        </p>
      )}
      <ul className="mt-3 divide-y divide-border">
        {bookings.map((b) => (
          <li key={b.invoice.id} className="flex flex-wrap items-center gap-3 py-3">
            {b.kind === "room" ? <Presentation className="h-5 w-5 shrink-0 text-primary" aria-hidden /> : <Laptop className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">
                {b.kind === "cowork" ? `${b.label} pass` : b.label}
                {b.kind === "room" && b.guest ? ` · for ${b.guest}` : ""}
              </span>
              <span className="block text-sm text-muted-foreground">
                {when(b)} · {eur(b.invoice.total)} · invoice {b.invoice.number}
              </span>
            </span>
            {b.status === "paid" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-900 dark:bg-green-950 dark:text-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Paid
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> {b.status === "partial" ? "Partly paid" : "Pending payment"}
                </span>
                <a href={payLaterUrl(b.invoice)} className="text-sm font-medium text-primary underline underline-offset-2">
                  Pay by bank transfer
                </a>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
