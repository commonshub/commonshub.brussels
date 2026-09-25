"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  BANK_DETAILS as BANK,
  epcQrPayload,
  formatIban,
} from "@/lib/bank-details"

export function BankTransferDetails({
  message = BANK.message,
  amountEur,
  frequency,
}: {
  /** Transfer message; a page for one expense passes its own reference. */
  message?: string
  /** Suggested amount, shown as a row and embedded in the copied payload. */
  amountEur?: number
  /** For a standing order: how often, shown as its own row. */
  frequency?: string
} = {}) {
  const [copied, setCopied] = useState<string | null>(null)

  const rows: { label: string; value: string; copyValue?: string }[] = [
    { label: "Beneficiary", value: BANK.beneficiary },
    { label: "IBAN", value: formatIban(BANK.iban), copyValue: BANK.iban },
    { label: "BIC", value: BANK.bic },
    ...(amountEur
      ? [{ label: "Amount", value: `€${amountEur.toFixed(2)}`, copyValue: amountEur.toFixed(2) }]
      : []),
    ...(frequency ? [{ label: "Frequency", value: frequency }] : []),
    { label: "Message", value: message },
  ]

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(
        () => setCopied((current) => (current === key ? null : current)),
        2000
      )
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  // Same EPC069-12 payload as the QR code, for apps that read it from the
  // clipboard
  const epcPayload = epcQrPayload(amountEur, message)

  return (
    <div className="w-full max-w-md flex flex-col gap-2 text-left">
      <dl className="flex flex-col divide-y divide-border rounded-md border border-border">
        {rows.map(({ label, value, copyValue }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="font-mono text-sm text-foreground wrap-break-word">
                {value}
              </dd>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => copy(label, copyValue ?? value)}
              aria-label={
                copied === label ? `${label} copied` : `Copy ${label}`
              }
            >
              {copied === label ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        ))}
      </dl>
      {/* The payment payload fills in a one-off transfer; a standing order is set up by hand. */}
      {!frequency && (
      <Button
        type="button"
        variant="outline"
        onClick={() => copy("all", epcPayload)}
        className="self-center"
      >
        {copied === "all" ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        {copied === "all" ? "Copied" : "Copy for banking app"}
      </Button>
      )}
    </div>
  )
}
