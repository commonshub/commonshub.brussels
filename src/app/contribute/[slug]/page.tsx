import { notFound, permanentRedirect } from "next/navigation"

import { findExpense, loadContributeExpenses, resolveExpenseSlug } from "@/lib/contribute-expenses"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

/** Expenses moved to /expenses/<slug>; old links, including chb's b-… bill ids, still work. */
export default async function OldContributeExpense({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ thanks?: string }> }) {
  const { slug } = await params
  const { thanks } = await searchParams
  const expenses = loadContributeExpenses()
  const target = findExpense(slug, expenses)?.slug ?? resolveExpenseSlug(slug, expenses)
  if (!target) notFound()
  permanentRedirect(`/expenses/${target}${thanks ? `?thanks=${encodeURIComponent(thanks)}` : ""}`)
}
