import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

import { ContributionPanel, type StripeMode } from "@/components/contribute/contribution-panel"
import { ExpenseComments } from "@/components/expenses/expense-comments"
import { ExpenseTags } from "@/components/expenses/expense-tags"
import { isMember } from "@/lib/admin-check"
import { loadComments } from "@/lib/comments-data"
import { findExpense, loadContributeExpenses, resolveExpenseSlug } from "@/lib/contribute-expenses"
import { formatEur } from "@/lib/contribute"
import { tierFor } from "@/lib/data-paths"
import { loadExpenseContributions } from "@/lib/expense-contributions"
import { COMMUNITY, RELAYS, siteIdentity } from "@/lib/nostr-server"

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

/**
 * One expense: what it is, how to contribute towards it, who already did,
 * its tags and the conversation about it (both on Nostr).
 */
export default async function ExpensePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { thanks } = await searchParams
  const expenses = loadContributeExpenses()
  const expense = findExpense(slug, expenses)
  if (!expense) {
    // chb's public bill id, a bill number, or a merged cost's old slug.
    const current = resolveExpenseSlug(slug, expenses)
    if (current && current !== slug) permanentRedirect(`/expenses/${current}`)
    notFound()
  }

  const member = await isMember()
  const [comments] = await Promise.all([loadComments(expense.uri)])
  const contributions = loadExpenseContributions(expense, tierFor(member))
  const site = siteIdentity()

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
            All expenses
          </Link>
          <p className="mt-6 text-sm uppercase tracking-wide text-muted-foreground">
            {recurring ? "Recurring cost" : "One-time expense"}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">{expense.label}</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{formatEur(expense.amountEur)}</span>
            {recurring ? " per month" : ""}
            {expense.annualAmount ? ` (${formatEur(expense.annualAmount)} a year)` : ""}
            {expense.vendor ? ` · ${expense.vendor}` : ""}
            {expense.date ? ` · ${recurring ? "last bill" : "billed"} ${formatDate(expense.date)}` : ""}
            {expense.dueDate ? (
              <span>{` · due ${formatDate(expense.dueDate)}`}</span>
            ) : null}
          </p>
          {expense.description && <p className="mt-4 max-w-2xl text-muted-foreground">{expense.description}</p>}
          {expense.slug.endsWith("-tax") && (
            <p className="mt-2 text-sm">
              <Link href="/taxes" className="underline underline-offset-2 hover:text-foreground text-muted-foreground">
                Everything we pay in taxes
              </Link>
            </p>
          )}
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
          <div className="mt-4">
            <ExpenseTags uri={expense.uri} category={expense.category} canEdit={member} />
          </div>
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
                {thanks === "monthly" ? (
                  <>
                    Thank you. You are now one of the people behind <strong>{expense.label}</strong>, every month. You will get a receipt by email each time, and can stop whenever you like.
                  </>
                ) : (
                  <>
                    Thank you. Your contribution to <strong>{expense.label}</strong> went through, and a bit of you now lives in the space.
                  </>
                )}
              </p>
            </div>
          )}

          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground">Chip in</h2>
            <p className="mt-2 text-muted-foreground">
              {recurring
                ? `A month of it costs ${formatEur(expense.amountEur)}. You don't have to cover all of it: any amount from €10 helps, and the slider starts at half a month. Want to be one of the people behind it? Make it monthly, by card or with a standing order.`
                : "Cover this bill in full, or chip in a part of it: any amount from €10 helps. The stewards then do not have to find the money for it elsewhere, and you know exactly what you paid for."}
            </p>
          </div>

          <ContributionPanel
            slug={expense.slug}
            label={expense.label}
            expenseEur={expense.amountEur}
            message={expense.message}
            stripe={stripe}
            recurring={recurring}
            short={expense.short}
          />

          <div>
            <h2 className="text-2xl font-bold text-foreground">Who contributed</h2>
            {contributions.count === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nobody yet. Be the first.</p>
            ) : (
              <>
                <p className="mt-3 text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{formatEur(contributions.total)}</span> in{" "}
                  {contributions.count} {contributions.count === 1 ? "contribution" : "contributions"} so far.
                </p>
                {member && contributions.contributors.length > 0 && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{contributions.contributors.map((c) => c.name).join(" · ")}</p>
                )}
              </>
            )}
          </div>

          {site && <ExpenseComments uri={expense.uri} initial={comments} canComment={member} sitePubkey={site.pubkey} community={COMMUNITY} relays={RELAYS} />}
        </div>
      </section>
    </main>
  )
}
