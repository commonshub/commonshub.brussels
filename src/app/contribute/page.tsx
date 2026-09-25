import Link from "next/link"
import { ArrowRight, Heart, Receipt, Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import { loadContributeExpenses, type ContributableExpense } from "@/lib/contribute-expenses"
import { formatEur } from "@/lib/contribute"
import { FixedCostsChart } from "@/components/contribute/fixed-costs-chart"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Contribute | Commons Hub Brussels",
  description:
    "This space only exists because of everyone's contribution. Take on one of our expenses, or make a donation.",
}

function formatDate(iso: string): string {
  if (!iso) return ""
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function ExpenseCard({ expense, total }: { expense: ContributableExpense; total?: number }) {
  const recurring = expense.kind === "recurring"
  const share = recurring && total ? (expense.amountEur / total) * 100 : null
  return (
    <Link
      href={`/contribute/${expense.slug}`}
      className="group flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-foreground">{expense.label}</h3>
          <div className="text-right whitespace-nowrap">
            <div className="text-lg font-bold tabular-nums text-foreground">{formatEur(expense.amountEur)}</div>
            {recurring && <div className="text-xs text-muted-foreground">per month</div>}
            {expense.annualAmount && <div className="text-xs text-muted-foreground">{formatEur(expense.annualAmount)} a year</div>}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[
            // Without a bill to read the vendor from, it is the label again: skip it.
            expense.vendor !== expense.label ? expense.vendor : null,
            !recurring && expense.date ? formatDate(expense.date) : null,
            share !== null ? `${share < 1 ? share.toFixed(1) : Math.round(share)}% of the fixed costs` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {recurring && expense.description && (
          <p className="mt-3 text-sm text-muted-foreground">{expense.description}</p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        Chip in
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export default function ContributePage() {
  const expenses = loadContributeExpenses()
  const recurringTotal = expenses.recurring.reduce((sum, e) => sum + e.amountEur, 0)

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">Contribute</h1>
            <p className="mt-6 text-xl text-muted-foreground">
              This space only exists because of everyone&apos;s contribution. We invite you to also
              contribute: leave a bit of you in the space, make it yours.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-16">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-8">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <Heart className="h-6 w-6 text-primary" />
                The easiest for you
              </h2>
              <p className="mt-3 text-muted-foreground">
                Make a donation. Any amount, by card, Bancontact or bank transfer, in a minute.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/donate">
                  Make a donation
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="rounded-lg border-2 border-primary bg-card p-8">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <Receipt className="h-6 w-6 text-primary" />
                The easiest for us
              </h2>
              <p className="mt-3 text-muted-foreground">
                Cover something we actually need. When we buy it ourselves we have to go and get it,
                account for it in our books, file the VAT and carry all the paperwork that comes with
                it. That is a lot of work for the stewards. When you take on a specific expense, all
                of that disappears.
              </p>
              <p className="mt-3 font-medium text-foreground">
                So the best way to contribute is to take responsibility for one expense of the
                commons. Pick one below.
              </p>
            </div>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Repeat className="h-6 w-6 text-primary" />
              Recurring costs
            </h2>
            <p className="mt-2 text-muted-foreground">
              What keeping the doors open costs every month, taxes included. You don&apos;t have to
              cover a whole month: chip in whatever part you like, from €10, once or every month.
            </p>
            {expenses.recurring.length > 0 && (
              <div className="mt-6">
                <FixedCostsChart costs={expenses.recurring} />
              </div>
            )}
            {expenses.recurring.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {expenses.recurring.map((expense) => (
                  <ExpenseCard key={expense.slug} expense={expense} total={recurringTotal} />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                The list is being refreshed. Come back in a moment, or{" "}
                <Link href="/donate" className="underline">
                  make a donation
                </Link>
                .
              </p>
            )}
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Receipt className="h-6 w-6 text-primary" />
              One-time expenses
            </h2>
            <p className="mt-2 text-muted-foreground">
              Things we bought for the space over the last year, straight from our books. Food and
              drinks are left out: they are gone by the next day. Everything here is still in the
              space. Cover one in full, or chip in a part of it.
            </p>
            {expenses.oneTime.length > 0 ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {expenses.oneTime.map((expense) => (
                  <ExpenseCard key={expense.slug} expense={expense} />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">Nothing outstanding right now.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
