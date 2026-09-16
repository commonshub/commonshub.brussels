import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

import { ContributionPanel, type StripeMode } from "@/components/contribute/contribution-panel"
import { findExpense, loadContributeExpenses } from "@/lib/contribute-expenses"
import { formatEur } from "@/lib/contribute"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

const STRIPE_DONATION_URL = "https://buy.stripe.com/7sIdSnbxz7AE1bi28m"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ thanks?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const expense = findExpense(slug, loadContributeExpenses())
  if (!expense) return { title: "Contribute | Commons Hub Brussels" }
  return {
    title: `Cover ${expense.label} | Commons Hub Brussels`,
    description: `Take on ${expense.label} (${formatEur(expense.amountEur)}) for the Commons Hub Brussels.`,
  }
}

function formatDate(iso: string): string {
  if (!iso) return ""
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function ContributeExpensePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { thanks } = await searchParams
  const expense = findExpense(slug, loadContributeExpenses())
  if (!expense) notFound()

  const recurring = expense.kind === "recurring"
  // A Checkout Session needs the secret key on the server; without it the
  // fixed payment link still works, tagged with the expense.
  const stripe: StripeMode = process.env.STRIPE_SECRET_KEY
    ? { kind: "checkout" }
    : { kind: "link", url: STRIPE_DONATION_URL }

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-12 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/contribute"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All ways to contribute
          </Link>
          <p className="mt-6 text-sm uppercase tracking-wide text-muted-foreground">
            {recurring ? "Recurring cost" : "One-time expense"}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">{expense.label}</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{formatEur(expense.amountEur)}</span>
            {recurring ? " per month" : ""}
            {" · "}
            {expense.vendor}
            {expense.date ? ` · ${recurring ? "last bill" : "billed"} ${formatDate(expense.date)}` : ""}
          </p>
          {expense.description && <p className="mt-4 max-w-2xl text-muted-foreground">{expense.description}</p>}
          {!recurring && expense.lines.length > 1 && (
            <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
              {expense.lines.slice(0, 8).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {!recurring && (
            <p className="mt-2 text-xs text-muted-foreground">Reference {expense.reference}</p>
          )}
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-8">
          {thanks && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-primary bg-primary/5 p-5 text-foreground"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p>
                Thank you. Your contribution to <strong>{expense.label}</strong> went through, and a
                bit of you now lives in the space.
              </p>
            </div>
          )}

          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground">Take it on</h2>
            <p className="mt-2 text-muted-foreground">
              {recurring
                ? "Cover a month of it, or part of one. If you would like to cover it every month, set up a standing order with the bank details below: the message stays the same each time."
                : "Cover this bill, or part of it. The stewards then do not have to find the money for it elsewhere, and you know exactly what you paid for."}
            </p>
          </div>

          <ContributionPanel
            slug={expense.slug}
            label={expense.label}
            expenseEur={expense.amountEur}
            message={expense.message}
            stripe={stripe}
          />
        </div>
      </section>
    </main>
  )
}
