"use client"

import { useState } from "react"
import { CheckCircle2, ChevronRight, CreditCard, Landmark, Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type BotInvoice, payLaterUrl } from "@/lib/invoice-payment"

/**
 * Paying a booking in euros (the token bot makes an Odoo invoice for every
 * one): who we invoice (one of the member's organisations, kept in Odoo by
 * the bot, or themselves), then pay now by card or get the invoice and pay
 * later by transfer.
 */

export type Address = { street: string; zip: string; city: string; country: string }
export type Lang = "en_GB" | "fr_BE" | "nl_BE"
/** The language Odoo writes invoices and their emails in. */
export const LANGS: Array<[Lang, string]> = [
  ["en_GB", "English"],
  ["fr_BE", "Français"],
  ["nl_BE", "Nederlands"],
]
/** existing: saved as new but already in Odoo (same VAT number), linked with the details Odoo has. */
export type Org = { id: number; name: string; vat: string | null; email: string | null; address: Address; billing: (Address & { id: number }) | null; self?: boolean; lang?: Lang; existing?: boolean }
export type EurQuote = { untaxed: number; vat: number; total: number; discount: number; lines: Array<{ label: string; quantity: number; unitPrice: number; discount: number }> }

export const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n)

async function post(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/hub/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong, please try again." }))
  if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong, please try again.")
  return data
}

export const loadOrgs = (): Promise<Org[]> => post("orgs").then((r: { orgs: Org[] }) => r.orgs)

/** The price in euros: list price, member discount, VAT, total. */
export function EurSummary({ quote, label }: { quote: EurQuote; label: string }) {
  const list = quote.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  return (
    <div className="space-y-1 rounded-xl bg-muted p-3 text-sm">
      <div className="flex justify-between gap-3">
        <span>{label}</span>
        <span className={quote.discount ? "text-muted-foreground line-through" : ""}>{eur(list)}</span>
      </div>
      {quote.discount > 0 && (
        <div className="flex justify-between gap-3">
          <span>Member price (−{quote.discount}%)</span>
          <span>{eur(quote.untaxed)}</span>
        </div>
      )}
      <div className="flex justify-between gap-3 text-muted-foreground">
        <span>VAT 21%</span>
        <span>{eur(quote.vat)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-border pt-1.5 text-base font-semibold text-foreground">
        <span>Total</span>
        <span>{eur(quote.total)}</span>
      </div>
    </div>
  )
}

/** "Invoice to › [organisation] · sent to [email]". */
export function InvoiceToRow({ org, onClick }: { org: Org | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary/60">
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">Invoice to</span>
        <span className="block truncate font-semibold text-foreground">{org ? (org.self ? `${org.name} (myself)` : org.name) : "Choose or add an organisation"}</span>
        {org?.email && <span className="block truncate text-xs text-muted-foreground">Billing email: {org.email}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

/** Pick who we invoice, edit one, or add one. */
export function OrgPicker({ orgs, selected, onPick, onEdit, onAdd, onBack }: { orgs: Org[]; selected: number | null; onPick: (id: number) => void; onEdit: (o: Org) => void; onAdd: () => void; onBack: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Who do we invoice?</DialogTitle>
        <DialogDescription>Every booking paid in euros gets an invoice, paid now or later.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2" role="radiogroup" aria-label="Invoice to">
        {orgs.map((o) => (
          <div key={o.id} className={`flex items-start gap-2 rounded-xl border-2 p-3 ${selected === o.id ? "border-primary bg-primary/10" : "border-border"}`}>
            <button type="button" role="radio" aria-checked={selected === o.id} onClick={() => onPick(o.id)} className="min-w-0 flex-1 text-left">
              <span className="block font-semibold text-foreground">{o.self ? `${o.name} (myself, no company)` : o.name}</span>
              {!o.self && <span className="block text-xs text-muted-foreground">{o.vat ? `VAT ${o.vat}` : "No VAT number"}</span>}
              <span className="block text-xs text-muted-foreground">{[o.address.street, `${o.address.zip} ${o.address.city}`.trim()].filter(Boolean).join(", ")}</span>
              {o.billing && <span className="block text-xs text-muted-foreground">Billing: {o.billing.street}, {o.billing.zip} {o.billing.city}</span>}
              {o.email && <span className="block text-xs text-foreground/80">Billing email: {o.email}</span>}
              {o.existing && <span className="block text-xs text-foreground/80">Already in our books: we kept the details we have. Edit them if something changed.</span>}
            </button>
            <Button variant="link" size="sm" className="px-1" onClick={() => onEdit(o)}>
              Edit
            </Button>
          </div>
        ))}
        {orgs.length === 0 && <p className="text-sm text-muted-foreground">No organisation yet: add the one to invoice.</p>}
        <Button variant="outline" className="w-full border-dashed" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add an organisation
        </Button>
        <p className="text-xs text-muted-foreground">Kept in our books (Odoo). Changes are saved there too.</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onBack} disabled={selected === null}>
          Use this organisation
        </Button>
      </div>
    </>
  )
}

const emptyAddress: Address = { street: "", zip: "", city: "", country: "BE" }

/** Add or edit an organisation: VAT lookup (VIES), address, optional billing address, invoice email. */
export function OrgForm({ org, onSaved, onCancel }: { org: Org | null; onSaved: (o: Org) => void; onCancel: () => void }) {
  const [vat, setVat] = useState(org?.vat ?? "")
  const [name, setName] = useState(org?.name ?? "")
  const [email, setEmail] = useState(org?.email ?? "")
  const [lang, setLang] = useState<Lang>(org?.lang ?? "en_GB")
  const [address, setAddress] = useState<Address>(org?.address ?? emptyAddress)
  const [hasBilling, setHasBilling] = useState(!!org?.billing)
  const [billing, setBilling] = useState<Address>(org?.billing ?? emptyAddress)
  const [busy, setBusy] = useState<"vat" | "save" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vatNote, setVatNote] = useState<string | null>(null)

  async function lookUp() {
    setError(null)
    setVatNote(null)
    setBusy("vat")
    try {
      const { result } = await post("vat", { vat })
      if (!result.valid) setVatNote("Not a valid VAT number on VIES.")
      else {
        setVatNote("✓ Valid on VIES")
        if (result.name) setName(result.name)
        if (result.address) setAddress((a) => ({ ...a, ...result.address }))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    setError(null)
    setBusy("save")
    try {
      const { org: saved } = await post("org", {
        ...(org ? { id: String(org.id) } : {}),
        name,
        vat,
        email,
        street: address.street,
        zip: address.zip,
        city: address.city,
        country: address.country,
        billing: hasBilling ? "yes" : "no",
        lang,
        ...(hasBilling ? { billingstreet: billing.street, billingzip: billing.zip, billingcity: billing.city, billingcountry: billing.country } : {}),
      })
      onSaved(saved)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, extra: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => set(e.target.value)} {...extra} />
    </div>
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{org ? (org.self ? "Your details" : "Organisation details") : "Add an organisation"}</DialogTitle>
        <DialogDescription>As they should appear on the invoice.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {!org?.self && (
          <div className="space-y-1.5">
            <Label htmlFor="org-vat">VAT number</Label>
            <div className="flex gap-2">
              <Input id="org-vat" value={vat} placeholder="BE0123456789" onChange={(e) => setVat(e.target.value)} />
              <Button variant="outline" onClick={lookUp} disabled={!vat.trim() || busy !== null}>
                {busy === "vat" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Look up
              </Button>
            </div>
            {vatNote && <p className="text-xs text-muted-foreground">{vatNote}</p>}
          </div>
        )}
        {field("org-name", org?.self ? "Name" : "Legal name", name, setName, { maxLength: 120 })}
        {field("org-street", "Address", address.street, (v) => setAddress({ ...address, street: v }), { maxLength: 120 })}
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          {field("org-zip", "Postcode", address.zip, (v) => setAddress({ ...address, zip: v }), { maxLength: 12 })}
          {field("org-city", "City", address.city, (v) => setAddress({ ...address, city: v }), { maxLength: 80 })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasBilling} onChange={(e) => setHasBilling(e.target.checked)} className="h-4 w-4 accent-primary" />
          Different billing address (optional)
        </label>
        {hasBilling && (
          <div className="space-y-2 rounded-xl bg-muted p-3">
            {field("bill-street", "Billing address", billing.street, (v) => setBilling({ ...billing, street: v }), { maxLength: 120 })}
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              {field("bill-zip", "Postcode", billing.zip, (v) => setBilling({ ...billing, zip: v }), { maxLength: 12 })}
              {field("bill-city", "City", billing.city, (v) => setBilling({ ...billing, city: v }), { maxLength: 80 })}
            </div>
          </div>
        )}
        {field("org-email", "Billing email address", email, setEmail, { type: "email", maxLength: 200, placeholder: "billing@yourcompany.com" })}
        <div className="space-y-1.5">
          <Label htmlFor="org-lang">Invoice language</Label>
          <select id="org-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            {LANGS.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy !== null}>
            Back
          </Button>
          <Button onClick={save} disabled={busy !== null}>
            {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </div>
      </div>
    </>
  )
}

/** Pay now by card, or send the invoice and pay later. */
export function PayChoice({ total, org, busy, error, onCard, onLater, onBack }: { total: number; org: Org; busy: "card" | "later" | null; error: string | null; onCard: () => void; onLater: () => void; onBack: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Pay {eur(total)}</DialogTitle>
        <DialogDescription>
          Either way, the invoice goes to {org.name}
          {org.email ? `, billing email ${org.email}` : ""}.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <button type="button" onClick={onCard} disabled={busy !== null} className="flex w-full items-center gap-3 rounded-xl bg-primary p-4 text-left text-primary-foreground disabled:opacity-60">
          {busy === "card" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" aria-hidden />}
          <span className="flex-1">
            <span className="block font-medium">Pay now by card</span>
            <span className="block text-xs opacity-90">Card, Bancontact or Apple Pay · the invoice is marked paid</span>
          </span>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={onLater} disabled={busy !== null} className="flex w-full items-center gap-3 rounded-xl border-2 border-primary p-4 text-left disabled:opacity-60">
          {busy === "later" ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Landmark className="h-5 w-5 text-primary" aria-hidden />}
          <span className="flex-1">
            <span className="block font-medium text-primary">Send the invoice, pay later</span>
            <span className="block text-xs text-muted-foreground">Bank transfer within 14 days</span>
          </span>
          <ChevronRight className="h-5 w-5 text-primary" aria-hidden />
        </button>
        <p className="text-center text-xs text-muted-foreground">Either way the booking is made and the invoice is emailed.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack} disabled={busy !== null}>
          Back
        </Button>
      </div>
    </>
  )
}

/**
 * Booked, invoice sent: pay it by bank transfer (/pay, with the QR code), or come back to the
 * dashboard, which lists the booking and whether it is paid.
 */
export function InvoiceConfirmation({ what, invoice, note }: { what: string; invoice: BotInvoice; note?: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-700 dark:text-green-400" aria-hidden /> Booked
        </DialogTitle>
        <DialogDescription>
          {what}. {invoice.emailed ? `Invoice ${invoice.number} (${eur(invoice.total)}) is on its way to ${invoice.sentTo ?? "you"}.` : `Invoice ${invoice.number} (${eur(invoice.total)}): we couldn't email it, a steward will send it to you.`}
        </DialogDescription>
      </DialogHeader>
      {note && <p className="text-sm text-destructive">{note}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => window.location.assign("/")}>
          Done
        </Button>
        <Button asChild>
          <a href={payLaterUrl(invoice)}>Pay {eur(invoice.total)} by bank transfer</a>
        </Button>
      </div>
    </>
  )
}
