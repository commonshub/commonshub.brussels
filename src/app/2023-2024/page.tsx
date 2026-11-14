import Link from "next/link"
import { cookies, headers } from "next/headers"
import { AlertTriangle, ChevronDown, FileText, ReceiptText } from "lucide-react"

import { LangSwitch } from "@/components/lang-switch"
import { countryFlag } from "@/lib/country-flag"
import { VatBox } from "@/components/vat-box"
import { type Lang, LOCALE, RATE_LABELS, REGIME_WHY_FR, SELF_ASSESSED, TEXT, type PageText, pickLang, ruleText } from "@/lib/vat-i18n"
import { explorerTxUrl, matchVatPayments } from "@/lib/taxes"
import { loadTaxPayments, loadVatReturns } from "@/lib/taxes-data"
import {
  type CategoryLine,
  type Direction,
  type Item,
  LARGE,
  REGIME_WHY,
  type RateClass,
  SELF_ASSESSED_RATE,
  type Side,
  declaredInputVat,
  declaredSalesVat,
  findPeriod,
  quarterKey,
  returnOverdue,
  subjectToVat,
  VAT_REGISTERED_SINCE,
  vatPosition,
} from "@/lib/vat-position"
import { firstMonthByAccount, loadTransactions, quarterHasData } from "@/lib/vat-position-data"
import settings from "@/settings/settings.json"

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ lang?: string }>
}

async function langOf(searchParams: PageProps["searchParams"]): Promise<Lang> {
  const [{ lang }, jar, h] = await Promise.all([searchParams, cookies(), headers()])
  return pickLang(lang, jar.get("lang")?.value, h.get("accept-language"))
}

export async function generateMetadata({ searchParams }: PageProps) {
  const t = TEXT[await langOf(searchParams)]
  return { title: t.title, description: t.description }
}

const YEARS = [2023, 2024]
const COLLECTIVES = (settings.finance as { collectives?: Record<string, { name: string }> }).collectives ?? {}
const BANK_ACCOUNT = "kbc"
/** Number and date formatting in the page's language. */
function formatters(lang: Lang) {
  const locale = LOCALE[lang]
  const eurF = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })
  const eur0F = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
  return {
    eur: (n: number) => eurF.format(n),
    eur0: (n: number) => eur0F.format(n),
    signed: (n: number) => (n < 0 ? `−${eurF.format(-n)}` : eurF.format(n)),
    shortDate: (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    longDate: (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    monthName: (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
  }
}
type F = ReturnType<typeof formatters>
const round = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => round(xs.reduce((s, x) => s + x, 0))

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" | "good" }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl ${tone === "warn" ? "text-amber-700 dark:text-amber-400" : tone === "good" ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
        {value}
      </div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

/** One side (income or expenses): a row per VAT rate, opening onto its categories and why that rate. */
function RateBreakdown({ side, dir, lang, f }: { side: Side; dir: Direction; lang: Lang; f: F }) {
  const t = TEXT[lang]
  return (
    <div className="mt-6 divide-y divide-border rounded-lg border border-border">
      {side.groups.map((g) => (
        <details key={g.rate} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40">
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            <span className="min-w-0 flex-1 font-medium text-foreground">{RATE_LABELS[lang][g.rate]}</span>
            <span className="text-right tabular-nums">
              {f.eur(g.amount)}
              <span className="block text-xs text-muted-foreground">
                {g.vat === null
                  ? t.vatNotEstimated
                  : dir === "expense" && (g.rate === "reverse_eu" || g.rate === "reverse_noneu")
                    ? SELF_ASSESSED[lang](f.eur(round(g.amount * SELF_ASSESSED_RATE)))
                    : `${f.eur(g.vat)} ${t.vat}`}
              </span>
            </span>
          </summary>
          <ul className="divide-y divide-border bg-muted/20 text-sm">
            {g.lines.map((l) => {
              const text = lineText(l, g.rate, dir, lang, f)
              return (
                <li key={l.category || "none"} className="px-4 py-3 sm:pl-11">
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{text.label}</div>
                      <div className="text-xs text-muted-foreground">{text.why}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      {f.eur(l.amount)}
                      <span className="block text-xs text-muted-foreground">{l.vat === null ? t.payments(l.count) : `${f.eur(l.vat)} ${t.vat}`}</span>
                    </div>
                  </div>
                  <LargeItems line={l} t={t} lang={lang} f={f} />
                </li>
              )
            })}
          </ul>
        </details>
      ))}
    </div>
  )
}

/** A category line's label and reason in the page's language (the "smaller amounts" name what they hold). */
function lineText(l: CategoryLine, rate: RateClass, dir: Direction, lang: Lang, f: F): { label: string; why: string } {
  const before = rate === "before"
  const base = ruleText(lang, dir, l.category, { label: l.label, why: l.why })
  // Under a cross-border regime, the regime is the reason, whatever the category.
  const regimeWhy = (lang === "fr" ? REGIME_WHY_FR : REGIME_WHY)[dir][rate]
  if (regimeWhy && !l.parts) return { label: base.label, why: regimeWhy }
  if (l.parts) {
    const label = lang === "fr" ? "Montants plus petits" : "Smaller amounts"
    return { label, why: l.parts.map((p) => `${ruleText(lang, dir, p.category, { label: p.label, why: "" }).label} (${f.eur0(p.amount)})`).join(", ") }
  }
  return before ? { label: base.label, why: TEXT[lang].beforeWhy(f.longDate(VAT_REGISTERED_SINCE)) } : base
}

/** Links to a payment's invoices or receipts in the Accounting Drive (they open for people with access). */
function DocLinks({ docs, lang }: { docs: string[]; lang: Lang }) {
  const label = lang === "fr" ? "Facture" : "Invoice"
  const title = lang === "fr" ? "Ouvrir dans le Google Drive de la comptabilité (accès requis)" : "Open in the accounting Google Drive (access needed)"
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {docs.map((url, n) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={title} className="inline-flex items-center gap-0.5 text-primary hover:underline">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {docs.length > 1 ? `${label} ${n + 1}` : label}
        </a>
      ))}
    </span>
  )
}

/** One listed payment (or a group of transfers that are one thing), linked to where it can be checked and annotated. */
function ItemRow({ i, t, lang, f, showProject }: { i: Item; t: PageText; lang: Lang; f: F; showProject: boolean }) {
  if (i.group) {
    const detail = lang === "fr" ? i.group.detailFr ?? i.group.detail : i.group.detail
    return (
      <li className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-5 text-foreground">{groupLabel(i.group, lang)}</div>
          {detail && <div className="text-muted-foreground">{detail}</div>}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-5">
            <Link href={i.href} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary" title={t.openFirst}>
              <ReceiptText className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="underline decoration-dotted underline-offset-2">
                {t.transfers(i.count ?? 1)}, {f.shortDate(i.date)}
                {i.group.until !== i.date ? ` – ${f.shortDate(i.group.until)}` : ""}
              </span>
            </Link>
            {i.group.document && (
              <a href={i.group.document.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {lang === "fr" ? i.group.document.labelFr ?? i.group.document.label : i.group.document.label}
              </a>
            )}
            {(i.docs?.length ?? 0) > 0 && <DocLinks docs={i.docs!} lang={lang} />}
          </div>
        </div>
        <div className="leading-5 tabular-nums text-foreground">{f.eur(i.amount)}</div>
      </li>
    )
  }
  const text = i.note || i.description
  const flag = countryFlag(i.note)
  return (
    <li className="flex gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1 leading-5 text-foreground">
          <Link href={i.href} className="inline-flex items-center gap-1 hover:text-primary" title={t.openTx}>
            <ReceiptText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="underline decoration-dotted underline-offset-2">{f.shortDate(i.date)}</span>
          </Link>
          {showProject && i.collective ? <span className="text-muted-foreground">· {projectName(i.collective, lang)}</span> : null}
          {(i.docs?.length ?? 0) > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <DocLinks docs={i.docs!} lang={lang} />
            </>
          )}
        </div>
        {text && (
          <div className="break-words text-muted-foreground">
            {flag && (
              <span className="mr-1" aria-hidden>
                {flag}
              </span>
            )}
            {text}
          </div>
        )}
      </div>
      <div className="leading-5 tabular-nums text-foreground">{f.eur(i.amount)}</div>
    </li>
  )
}

/** The listed payments and what they leave out. */
function ItemList({ items, amount, count, t, lang, f, showProject }: { items: Item[]; amount: number; count: number; t: PageText; lang: Lang; f: F; showProject: boolean }) {
  const rest = round(amount - sum(items.map((i) => i.amount)))
  const others = count - items.reduce((s, i) => s + (i.count ?? 1), 0)
  return (
    <ul className="mt-2 space-y-2 border-l-2 border-border pl-2 text-xs">
      {items.map((i, n) => (
        <ItemRow key={`${i.href}-${n}`} i={i} t={t} lang={lang} f={f} showProject={showProject} />
      ))}
      {others > 0 && (
        <li className="flex gap-3 text-muted-foreground">
          <div className="flex-1">{items.length === 0 ? t.payments(others) : t.smaller(others)}</div>
          <div className="tabular-nums">{f.eur(rest)}</div>
        </li>
      )}
    </ul>
  )
}

const projectName = (slug: string, lang: Lang) => (slug ? COLLECTIVES[slug]?.name ?? slug : lang === "fr" ? "Sans projet" : "No project")

/**
 * A category's payments. Spread over several projects: one line per project
 * (total, number of payments), opening onto its payments. One project only:
 * its large payments behind one toggle.
 */
function LargeItems({ line, t, lang, f }: { line: CategoryLine; t: PageText; lang: Lang; f: F }) {
  const projects = Object.entries(line.projects).sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))
  if (projects.length > 1) {
    return (
      <ul className="mt-2 divide-y divide-border/60 rounded-md border border-border/60 text-xs">
        {projects.map(([slug, pr]) => {
          const items = line.items.filter((i) => (i.collective ?? "") === slug)
          return (
            <li key={slug || "none"}>
              <details className="group/project">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 hover:bg-muted/40">
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/project:rotate-180" />
                  <span className="min-w-0 flex-1 font-medium text-foreground">{projectName(slug, lang)}</span>
                  <span className="text-muted-foreground">{t.payments(pr.count)}</span>
                  <span className="w-24 text-right tabular-nums text-foreground">{f.eur(pr.amount)}</span>
                </summary>
                <div className="px-2 pb-2">
                  <ItemList items={items} amount={pr.amount} count={pr.count} t={t} lang={lang} f={f} showProject={false} />
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    )
  }
  if (line.items.length === 0) return null
  return (
    <details className="group/items mt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/items:rotate-180" />
        {line.items.length === 1 && line.items[0].group
          ? `${groupLabel(line.items[0].group, lang)} : ${f.eur0(line.items[0].amount)}`.replace(" :", lang === "fr" ? " :" : ":")
          : t.items(
              line.items.map((i) => i.amount),
              f.eur0,
              line.items.some((i) => i.group),
            )}
      </summary>
      <ItemList items={line.items} amount={line.amount} count={line.count} t={t} lang={lang} f={f} showProject={false} />
    </details>
  )
}

const groupLabel = (g: NonNullable<CategoryLine["items"][number]["group"]>, lang: Lang) => (lang === "fr" ? g.labelFr ?? g.label : g.label)

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-border pt-1 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${tone === "good" ? "text-green-700 dark:text-green-400" : ""}`}>{value}</dd>
    </div>
  )
}

export default async function Vat20232024Page({ searchParams }: PageProps) {
  const lang = await langOf(searchParams)
  const t = TEXT[lang]
  const f = formatters(lang)
  const now = new Date()
  const vat = loadVatReturns()
  const lastYear = YEARS[YEARS.length - 1]
  const txs = loadTransactions([...YEARS, lastYear + 1])
  const position = vatPosition(txs, YEARS, explorerTxUrl)
  const { byPeriod } = matchVatPayments(vat?.periods ?? [], loadTaxPayments())

  // An account whose history starts after these years: what came in or went out there is missing.
  const bankFrom = firstMonthByAccount([...YEARS, lastYear + 1]).get(BANK_ACCOUNT)
  const bankMissing = !bankFrom || bankFrom > `${lastYear}-12`
  const yearsWithoutData = YEARS.filter((y) => !txs.some((tx) => new Date(tx.timestamp * 1000).getUTCFullYear() === y))

  const quarters = YEARS.flatMap((y) => [1, 2, 3, 4].map((q) => ({ y, q })))
    .filter(({ y, q }) => findPeriod(vat, y, q) || quarterHasData(y, q))
    .map(({ y, q }) => {
      const key = quarterKey(y, q)
      const period = findPeriod(vat, y, q)
      const settlement = period ? byPeriod.get(period.period) : undefined
      return {
        key,
        label: lang === "fr" ? `T${q} ${y}` : `${y} Q${q}`,
        period,
        missing: !period && returnOverdue(y, q, now),
        est: position.quarters.get(key) ?? { collected: 0, paid: 0 },
        net: period?.totals.net ?? 0,
        settled: settlement && settlement.status !== "none" ? settlement.payments : [],
      }
    })
  const filed = quarters.filter((q) => q.period)
  const missing = quarters.filter((q) => q.missing)

  const declaredSales = sum(filed.map((q) => declaredSalesVat(q.period!)))
  const declaredInput = sum(filed.map((q) => declaredInputVat(q.period!)))
  const estBalance = round(position.income.vat - position.expense.vat)
  const owed = sum(filed.filter((q) => q.net > 0).map((q) => q.net))
  const owedToUs = sum(filed.filter((q) => q.net < 0).map((q) => -q.net))
  const net = round(owed - owedToUs)
  const paid = sum(quarters.flatMap((q) => q.settled.filter((p) => p.amount > 0).map((p) => p.amount)))
  const refunded = sum(quarters.flatMap((q) => q.settled.filter((p) => p.amount < 0).map((p) => -p.amount)))
  const open = round(net - paid + refunded)
  // What the State would still owe us if all the VAT on our expenses were deductible:
  // the VAT we paid less the VAT we collected, less what has been settled already.
  const stillOwed = round(position.expense.vat - position.income.vat - (refunded - paid))
  // Each refund or payment once, with the quarters it settled (one refund can settle several).
  const settlements = [...quarters.flatMap((q) => q.settled.map((p) => ({ p, q: q.label })))
    .reduce((acc, { p, q }) => {
      const key = `${p.id}|${p.date}`
      const e = acc.get(key) ?? { id: p.id, date: p.date, amount: 0, quarters: [] as string[] }
      e.amount = round(e.amount + p.amount)
      e.quarters.push(q)
      return acc.set(key, e)
    }, new Map<string, { id: string; date: string; amount: number; quarters: string[] }>())
    .values()].sort((a, b) => a.date.localeCompare(b.date))
  const and = lang === "fr" ? " et " : " and "

  return (
    <main className="min-h-screen" lang={lang}>
      <section className="pt-32 pb-12 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t.kicker}</p>
            <LangSwitch lang={lang} />
          </div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-foreground">{t.heading}</h1>

          <div className="mt-8 max-w-3xl rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.tldrTitle}</h2>
            <div className="mt-2 space-y-2 text-lg leading-relaxed text-foreground">
              {t
                .tldr({
                  x1: f.eur0(position.income.vat),
                  x2: f.eur0(declaredSales),
                  gap: f.eur0(position.income.vat - declaredSales),
                  z: f.eur0(position.expense.vat),
                  z2: f.eur0(declaredInput),
                  z3: f.eur0(Math.abs(stillOwed)),
                  stateOwes: stillOwed >= 0,
                  refunded: f.eur0(refunded - paid),
                })
                .map((line, i) => (
                  <p key={i} className={i === 2 ? "font-semibold" : undefined}>
                    {line}
                  </p>
                ))}
            </div>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href="#income" className="text-primary underline-offset-2 hover:underline">→ {t.tldrLinks.income}</a>
              <a href="#expenses" className="text-primary underline-offset-2 hover:underline">→ {t.tldrLinks.expenses}</a>
              <a href="#balance" className="text-primary underline-offset-2 hover:underline">→ {t.tldrLinks.balance}</a>
            </p>
          </div>

          <p className="mt-6 max-w-3xl text-base text-muted-foreground">
            {t.intro(f.eur0(LARGE), f.longDate(VAT_REGISTERED_SINCE))}
            <a href={`https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?ondernemingsnummer=0804505132&lang=${lang}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {t.kbo}
            </a>
            {t.introEnd}
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
          {(bankMissing || yearsWithoutData.length > 0 || missing.length > 0) && (
            <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {t.incomplete}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {bankMissing && <li>{t.bankMissing(bankFrom ? f.monthName(bankFrom) : null)}</li>}
                {yearsWithoutData.length > 0 && <li>{t.noTxYears(yearsWithoutData.join(and))}</li>}
                {missing.length > 0 && <li>{t.noReturn(missing.map((q) => q.label).join(and))}</li>}
              </ul>
            </div>
          )}

          <div id="income" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-foreground">{t.income}</h2>
            <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Figure label={t.received} value={f.eur(position.income.amount)} note={t.vatIncluded} />
              <Figure label={t.vatInIt} value={f.eur(position.income.vat)} note={t.shouldHaveCharged} />
              <Figure label={t.declaredInReturns} value={f.eur(declaredSales)} note={t.salesGrids} tone={declaredSales < position.income.vat - 1 ? "warn" : undefined} />
            </div>
            <RateBreakdown side={position.income} dir="income" lang={lang} f={f} />
          </div>

          <div id="expenses" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-foreground">{t.expenses}</h2>
            <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Figure label={t.paidLbl} value={f.eur(position.expense.amount)} note={t.vatIncluded} />
              <Figure label={t.vatInIt} value={f.eur(position.expense.vat)} note={t.suppliersCharged} />
              <Figure label={t.deductedInReturns} value={f.eur(declaredInput)} note={t.purchasesGrid} />
            </div>
            <RateBreakdown side={position.expense} dir="expense" lang={lang} f={f} />
            <p className="mt-3 text-sm text-muted-foreground">{t.deductibleShare}</p>
          </div>

          <div id="balance" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-foreground">{t.balance}</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">{t.fromOurs}</h3>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row label={t.vatInIncome} value={f.eur(position.income.vat)} />
                  <Row label={t.vatInExpenses} value={`−${f.eur(position.expense.vat)}`} />
                  <Row label={estBalance < 0 ? t.balOwedToUs : t.balOwedToState} value={f.signed(estBalance)} strong tone={estBalance < 0 ? "good" : undefined} />
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">{t.estimateNote}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">{t.fromReturns}</h3>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row label={t.owedToState(filed.filter((q) => q.net > 0).length)} value={f.eur(owed)} />
                  <Row label={t.owedToUs(filed.filter((q) => q.net < 0).length)} value={owedToUs ? `−${f.eur(owedToUs)}` : f.eur(0)} tone="good" />
                  <Row label={t.balanceLbl} value={f.signed(net)} strong tone={net < 0 ? "good" : undefined} />
                  <Row label={t.paidByUs} value={paid ? `−${f.eur(paid)}` : f.eur(0)} />
                  <Row label={t.refundedToUs} value={refunded ? `+${f.eur(refunded)}` : f.eur(0)} />
                  <Row label={open < 0 ? t.stillOwedToUs : open > 0 ? t.stillOwedToState : t.stillOpen} value={f.signed(open)} strong tone={open < 0 ? "good" : undefined} />
                </dl>
                {settlements.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                    {settlements.map((st) => {
                      const onChain = explorerTxUrl(st.id)
                      const [y, m] = st.date.split("-")
                      return (
                        <li key={`${st.id}${st.date}`} className="flex justify-between gap-3">
                          <span>
                            {st.amount < 0 ? t.refundedOn : t.paidOn}{" "}
                            <a href={onChain ?? `/${y}/${m}/transactions?category=vat`} className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                              {f.shortDate(st.date)}
                            </a>{" "}
                            {t.forQuarters} {st.quarters.join(" + ")}
                          </span>
                          <span className="tabular-nums">{f.eur(Math.abs(st.amount))}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{open < 0 ? t.openNegative : open > 0 ? t.openPositive : t.settled}</p>
              </div>
            </div>

            <details className="group mt-4 rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium hover:bg-muted/40">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /> {t.byQuarter}
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.quarter}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.vatOnSales}<span className="block text-xs font-normal">{t.oursDeclared}</span></th>
                      <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">{t.vatOnPurchases}<span className="block text-xs font-normal">{t.oursDeducted}</span></th>
                      <th className="px-3 py-2 text-right font-medium">{t.returnLbl}</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">{t.paidRefunded}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quarters.map((q) => (
                      <tr key={q.key} className="align-top">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          <Link href={`/${q.key.replace("-", "/")}`} className="hover:underline">{q.label}</Link>
                          {q.missing && <div className="text-xs font-normal text-amber-700 dark:text-amber-400">{t.noReturnOnFile}</div>}
                          {!q.period && !subjectToVat(Number(q.key.slice(0, 4)), Number(q.key.slice(-1))) && <div className="text-xs font-normal text-muted-foreground">{t.notRegistered}</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {f.eur(q.est.collected)}
                          <span className="block text-xs text-muted-foreground">{q.period ? f.eur(declaredSalesVat(q.period)) : "—"}</span>
                        </td>
                        <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                          {f.eur(q.est.paid)}
                          <span className="block text-xs text-muted-foreground">{q.period ? f.eur(declaredInputVat(q.period)) : "—"}</span>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${q.net < 0 ? "text-green-700 dark:text-green-400" : ""}`}>
                          {q.period ? f.signed(q.net) : "—"}
                          {q.period && q.net !== 0 && <span className="block text-xs text-muted-foreground">{q.net < 0 ? t.owedToUsShort : t.owedToStateShort}</span>}
                        </td>
                        <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                          {!q.period || q.net === 0
                            ? "—"
                            : q.settled.length === 0
                              ? q.net < 0
                                ? t.notRefunded
                                : t.noPayment
                              : q.settled.map((p) => (p.amount < 0 ? t.refundedAmount : t.paidAmount)(f.eur(Math.abs(p.amount)), f.shortDate(p.date))).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          <div className="max-w-3xl space-y-3 text-sm text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">{t.howToRead}</h2>
            <p>{t.howOurs}</p>
            <p>{t.wiseCard}</p>
            <p>{t.grids4447}</p>
            <p>
              {t.sources[0]}
              <Link href="/integrity" className="underline underline-offset-2">{t.sources[1]}</Link>
              {t.sources[2]}
              <Link href="/taxes" className="underline underline-offset-2">{t.sources[3]}</Link>.
            </p>
            <p>
              {t.winbooks[0]}
              <Link href="/2023-2024/winbooks" className="underline underline-offset-2">{t.winbooks[1]}</Link>.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {YEARS.map((y) => (
              <VatBox key={y} year={y} now={now} lang={lang} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
