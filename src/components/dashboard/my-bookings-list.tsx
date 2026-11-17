"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, CreditCard, FileText, Landmark, Laptop, Loader2, Presentation, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { payLaterUrl } from "@/lib/invoice-payment"

export type MyBooking = ({ kind: "room"; label: string; start: string; end: string; guest?: string } | { kind: "cowork"; label: string; date: string }) & {
  invoice: { id: number; number: string; total: number; communication: string; pdfUrl: string | null; due: number }
  status: "paid" | "partial" | "pending" | "cancelled"
  cancel?: { refundPercent: number; refund: number }
  creditNote?: { number: string; total: number; pdfUrl: string | null }
}

const TZ = "Europe/Brussels"
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n)
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })
const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })

export function whenText(b: MyBooking, now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ })
  if (b.kind === "cowork") return b.date === today ? "Today" : day(new Date(`${b.date}T12:00:00Z`))
  const start = new Date(b.start)
  return `${start.toLocaleDateString("en-CA", { timeZone: TZ }) === today ? "Today" : day(start)}, ${hm(start)}–${hm(new Date(b.end))}`
}

async function post(action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/hub/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong, please try again." }))
  if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong, please try again.")
  return data
}

/** Upcoming and past bookings paid in euros: pay what's due, cancel a room, download the invoice. */
export function MyBookingsList({ upcoming, past, policy, paid }: { upcoming: MyBooking[]; past: MyBooking[]; policy: string; paid?: string }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming")
  const [paying, setPaying] = useState<MyBooking | null>(null)
  const [cancelling, setCancelling] = useState<MyBooking | null>(null)
  const list = tab === "upcoming" ? upcoming : past
  return (
    <section className="mt-4 rounded-2xl border border-border p-5" aria-labelledby="my-bookings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-bookings" className="text-lg font-bold text-foreground">
          Your bookings
        </h2>
        <div className="grid grid-cols-2 rounded-full border border-border p-1 text-sm" role="tablist" aria-label="Bookings">
          {(["upcoming", "past"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-8 rounded-full px-3 font-medium transition ${tab === t ? "bg-foreground text-background" : "text-foreground hover:bg-muted"}`}>
              {t === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
      </div>
      {paid && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Paid, thank you: invoice {paid}. Stripe emails you a receipt.
        </p>
      )}
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{tab === "upcoming" ? "Nothing booked yet." : "No past bookings in the last year."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {list.map((b) => (
            <li key={b.invoice.id} className="py-3">
              <div className="flex items-start gap-3">
                {b.kind === "room" ? <Presentation className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden /> : <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{whenText(b)}</p>
                  <p className="font-semibold text-foreground">
                    {b.kind === "cowork" ? `${b.label} pass` : b.label}
                    {b.kind === "room" && b.guest ? ` · for ${b.guest}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {eur(b.invoice.total)} · invoice{" "}
                    {b.invoice.pdfUrl ? (
                      <a href={b.invoice.pdfUrl} className="inline-flex items-center gap-1 text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        {b.invoice.number} (PDF)
                      </a>
                    ) : (
                      b.invoice.number
                    )}
                    {b.creditNote && (
                      <>
                        {" "}
                        · credit note{" "}
                        {b.creditNote.pdfUrl ? (
                          <a href={b.creditNote.pdfUrl} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                            {b.creditNote.number} (PDF)
                          </a>
                        ) : (
                          b.creditNote.number
                        )}{" "}
                        {eur(b.creditNote.total)}
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill b={b} />
                    {b.invoice.due > 0 && (
                      <Button size="sm" onClick={() => setPaying(b)}>
                        Pay {eur(b.invoice.due)}
                      </Button>
                    )}
                    {b.cancel && (
                      <Button size="sm" variant="outline" onClick={() => setCancelling(b)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="sm:max-w-md">{paying && <PayDialog b={paying} />}</DialogContent>
      </Dialog>
      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent className="sm:max-w-md">{cancelling && <CancelDialog b={cancelling} policy={policy} onDone={() => setCancelling(null)} />}</DialogContent>
      </Dialog>
    </section>
  )
}

function StatusPill({ b }: { b: MyBooking }) {
  const pill = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
  if (b.status === "cancelled") return <span className={`${pill} bg-muted text-muted-foreground`}><XCircle className="h-3.5 w-3.5" aria-hidden /> Cancelled</span>
  if (b.status === "paid") return <span className={`${pill} bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200`}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Paid</span>
  return <span className={`${pill} bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`}><Clock className="h-3.5 w-3.5" aria-hidden /> {b.status === "partial" ? "Partly paid" : "Pending payment"}</span>
}

function PayDialog({ b }: { b: MyBooking }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function card() {
    setError(null)
    setBusy(true)
    try {
      const { checkoutUrl } = await post("payinvoice", { invoiceId: String(b.invoice.id) })
      window.location.href = checkoutUrl
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Pay {eur(b.invoice.due)}</DialogTitle>
        <DialogDescription>Invoice {b.invoice.number}.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <button type="button" onClick={card} disabled={busy} className="flex w-full items-center gap-3 rounded-xl bg-primary p-4 text-left text-primary-foreground disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" aria-hidden />}
          <span className="flex-1">
            <span className="block font-medium">Pay by card</span>
            <span className="block text-xs opacity-90">Card, Bancontact or Apple Pay</span>
          </span>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <a href={payLaterUrl({ total: b.invoice.due, communication: b.invoice.communication })} className="flex w-full items-center gap-3 rounded-xl border-2 border-primary p-4 text-left">
          <Landmark className="h-5 w-5 text-primary" aria-hidden />
          <span className="flex-1">
            <span className="block font-medium text-primary">Pay by bank transfer</span>
            <span className="block text-xs text-muted-foreground">QR code for your banking app, with the communication filled in</span>
          </span>
          <ChevronRight className="h-5 w-5 text-primary" aria-hidden />
        </a>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </>
  )
}

function CancelDialog({ b, policy, onDone }: { b: MyBooking; policy: string; onDone: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ refundPercent: number; creditNote: { number: string; total: number } | null; refundDue: number } | null>(null)
  const pct = b.cancel?.refundPercent ?? 0
  const paid = b.status === "paid"
  async function confirm() {
    setError(null)
    setBusy(true)
    try {
      setResult(await post("cancelbooking", { invoiceId: String(b.invoice.id) }))
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (result)
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-700 dark:text-green-400" aria-hidden /> Cancelled
          </DialogTitle>
          <DialogDescription>
            {b.label}, {whenText(b)} is cancelled and the room is free again.{" "}
            {result.creditNote ? `Credit note ${result.creditNote.number} (${eur(result.creditNote.total)}) is on its way by email.` : "No refund, as it was less than 7 days before."}{" "}
            {result.refundDue ? `You had paid: a steward will pay ${eur(result.refundDue)} back to you.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </>
    )
  return (
    <>
      <DialogHeader>
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogDescription>
          {b.label}, {whenText(b)}.
        </DialogDescription>
      </DialogHeader>
      <div className={`flex gap-3 rounded-xl p-3 text-sm ${pct === 100 ? "bg-muted" : "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100"}`}>
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">
            {pct === 100
              ? `Full refund: ${eur(b.cancel!.refund)}.`
              : pct === 50
                ? `Late cancellation: 50% refund only (${eur(b.cancel!.refund)} of ${eur(b.invoice.total)}).`
                : `Less than 7 days before: no refund. The invoice (${eur(b.invoice.total)}) stays due.`}
          </p>
          <p className="mt-1">
            {pct > 0 ? `You get a credit note for ${eur(b.cancel!.refund)}${paid ? ", and a steward pays it back to you" : ""}.` : ""} {policy}
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Keep it
        </Button>
        <Button variant="destructive" onClick={confirm} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancel the booking
        </Button>
      </div>
    </>
  )
}
