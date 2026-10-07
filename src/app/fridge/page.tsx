import type { Metadata } from "next"

import { FridgeOrder } from "@/components/fridge/fridge-order"
import { loadContributeExpenses } from "@/lib/contribute-expenses"
import { FRIDGE, loadLatestDelivery } from "@/lib/fridge"

// Reads the dataset volume: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "The fridge | Commons Hub Brussels",
  description: "Take a drink from the fridge and make a donation, or offer a crate to the community.",
}

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })

/** Opened from the QR code on the fridge: what is in it, and paying for what you take. */
export default async function FridgePage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const { thanks } = await searchParams
  const delivery = loadLatestDelivery()
  // The space the fridge is in: the fixed monthly costs, as /contribute breaks them down.
  const fixedCosts = loadContributeExpenses()
    .recurring.filter((c) => c.amountEur > 0)
    .map((c) => ({ slug: c.slug, label: c.label, amount: Math.round(c.amountEur * 100) / 100 }))

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <h1 className="text-2xl font-bold text-foreground">The fridge</h1>
      {thanks ? (
        <p role="status" className="mt-4 rounded-xl border border-primary bg-primary/5 p-4 text-foreground">
          {thanks === "crate" ? "Thank you for the crate! 🍻" : "Thank you! Enjoy your drink. 🍻"}
        </p>
      ) : null}
      {delivery ? (
        <>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Help yourself. Pick what you take to see what it costs us, then make a donation. From our delivery of {day(delivery.date)}.
          </p>
          <FridgeOrder
            drinks={delivery.drinks}
            fixedCosts={fixedCosts}
            settings={{
              roundTo: FRIDGE.roundTo,
              minimum: FRIDGE.minimum,
              timeTokensPerMonth: FRIDGE.timeTokensPerMonth,
              transferMessage: FRIDGE.transferMessage,
              crateTransferMessage: FRIDGE.crateTransferMessage,
            }}
          />
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">The list of drinks is not available right now. Take what you like and make a donation at commonshub.brussels/donate.</p>
            )}
    </div>
  )
}
