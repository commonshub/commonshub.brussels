import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ExternalLink, FileText, History } from "lucide-react"

import { DeleteAnnotation } from "@/components/delete-annotation"
import { TransactionAnnotator } from "@/components/transaction-annotator"
import { isPartyId } from "@/lib/nip73"
import { driveDocs } from "@/lib/drive-docs"
import { RELAYS } from "@/lib/nostr-server"
import { isAdmin, isMember } from "@/lib/admin-check"
import { type AnnotationVersion, loadAnnotationHistory } from "@/lib/annotation-history"
import { tierFor } from "@/lib/data-paths"
import { explorerTxUrl } from "@/lib/taxes"
import { augmentTransaction, readMonthlyCounterpartyMetadata, readMonthlyTransactions } from "@/lib/transactions"
import { txSlug } from "@/lib/tx-slug"
import { EXPENSE_RULES, INCOME_RULES } from "@/lib/vat-position"
import settings from "@/settings/settings.json"

// Reads the dataset and the relays at request time.
export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ year: string; month: string; txid: string }>
}

const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const when = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })
const whenIso = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })

/** Where a transaction can be checked outside this site. */
function externalUrl(id: string): { href: string; label: string } | null {
  const onChain = explorerTxUrl(id)
  if (onChain) return { href: onChain, label: "See it on the blockchain" }
  if (id.startsWith("stripe:")) return { href: `https://dashboard.stripe.com/search?query=${encodeURIComponent(txSlug(id))}`, label: "See it in Stripe" }
  return null
}

export async function generateMetadata({ params }: PageProps) {
  const { year, month } = await params
  return { title: `Transaction · ${year}/${month} | Commons Hub Brussels`, robots: { index: false } }
}

function Versions({ versions }: { versions: AnnotationVersion[] }) {
  const relays = RELAYS
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">No annotation yet.</p>
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((v, i) => (
        <li key={v.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-foreground">
              {v.name}
              {i === 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">current</span>}
            </span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {whenIso(v.at)}
              <DeleteAnnotation eventId={v.id} author={v.pubkey} relays={relays} />
            </span>
          </div>
          {v.content && <p className="mt-1 whitespace-pre-line break-words text-foreground">{v.content}</p>}
          {v.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.tags.map((t, j) => (
                <span key={j} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {t[0] === "t" ? t[1] : `${t[0]}: ${t.slice(1).join(" ")}`}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

/**
 * One transaction: what the books say, where to check it, what members
 * have added to it (description, category, collective, labels, the
 * counterparty's name) and the history of those annotations on Nostr.
 * A blockchain transaction can carry several transfers; they are all here.
 */
export default async function TransactionPage({ params }: PageProps) {
  const { year, month, txid } = await params
  if (!/^20\d{2}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) notFound()
  const slug = decodeURIComponent(txid)

  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()])
  const canEdit = userIsAdmin || userIsMember
  const tier = tierFor(canEdit)
  const matches = (y: string, m: string) => readMonthlyTransactions(y, m, tier).filter((t) => txSlug(t.id) === slug || t.providerId === slug)
  const transfers = matches(year, month)
  if (transfers.length === 0) {
    // Dated around midnight, it can be filed under the month next door.
    for (const delta of [-1, 1]) {
      const d = new Date(Date.UTC(Number(year), Number(month) - 1 + delta, 1))
      const [y, m] = [String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0")]
      if (matches(y, m).length > 0) redirect(`/${y}/${m}/transactions/${encodeURIComponent(slug)}`)
    }
    notFound()
  }

  const cpMeta = readMonthlyCounterpartyMetadata(year, month, tier)
  const rows = transfers.map((t) => augmentTransaction(t, cpMeta))
  const uri = transfers[0].id
  const external = externalUrl(uri)
  // Only a real party can be named: not a masked id shared by many payments, nor a token contract, nor us.
  const first = transfers[0]
  const cpUris = [...new Set(rows.map((r) => r.counterpartyId).filter((c): c is string => isPartyId(c, first.accountId)))]
  // Names wrongly given to a shared id, so their authors can delete them.
  const sharedUris = [...new Set(rows.map((r) => r.counterpartyId).filter((c): c is string => !!c && !isPartyId(c, first.accountId)))]
  const history = await loadAnnotationHistory([uri, ...cpUris, ...sharedUris]).catch(() => ({}) as Record<string, AnnotationVersion[]>)

  const total = transfers.reduce((s, t) => s + t.amount, 0)
  const categories = [...new Set([...settings.finance.categories.credit, ...settings.finance.categories.debit, ...Object.keys(INCOME_RULES), ...Object.keys(EXPENSE_RULES)].filter((c) => !c.includes(":")))].sort()
  const collectivesObj = (settings.finance as { collectives?: Record<string, { name: string }> }).collectives ?? {}
  const collectives = Object.entries(collectivesObj).map(([value, c]) => ({ value, label: c.name }))
  const meta = first.metadata ?? {}
  const counterparty = isPartyId(rows[0].counterpartyId, first.accountId) ? { uri: rows[0].counterpartyId, name: rows[0].counterpartyMetadata?.name ?? "" } : null

  return (
    <main className="container mx-auto max-w-4xl px-4 py-24">
      <Link href={`/${year}/${month}/transactions`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All transactions of {year}/{month}
      </Link>

      <header className="mt-4">
        <p className="text-sm text-muted-foreground">{when(first.timestamp)}</p>
        <h1 className={`mt-1 text-4xl font-bold tabular-nums ${total >= 0 ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
          {total >= 0 ? "+" : "−"}
          {eur.format(Math.abs(total))}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {total >= 0 ? "Received on" : "Paid from"} {first.accountName || first.accountSlug}
          {transfers.length > 1 ? ` · ${transfers.length} transfers in one transaction` : ""}
        </p>
        {[...new Set(transfers.flatMap((t) => driveDocs(t.id, t.amount)))].map((url, n, all) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" title="Open in the accounting Google Drive (access needed)" className="mt-3 mr-4 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
            <FileText className="h-4 w-4" /> {all.length > 1 ? `Invoice or receipt ${n + 1}` : "Invoice or receipt"} (Drive)
          </a>
        ))}
        {external && (
          <a href={external.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
            <ExternalLink className="h-4 w-4" /> {external.label}
          </a>
        )}
      </header>

      <section className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Annotations</h2>
        <div className="mt-4">
          <TransactionAnnotator
            uri={uri}
            baseline={{ description: String(meta.description ?? ""), category: String(meta.category ?? ""), collective: String(meta.collective ?? "") }}
            counterparty={counterparty}
            canEdit={canEdit}
            categories={categories}
            collectives={collectives}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">{transfers.length > 1 ? "Transfers" : "Details"}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((r, i) => (
            <dl key={i} className="grid gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular-nums">
                {eur.format(transfers[i].amount)} {transfers[i].currency !== "EUR" ? <span className="text-muted-foreground">({transfers[i].currency})</span> : null}
              </dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{r.rawType}</dd>
              <dt className="text-muted-foreground">Counterparty</dt>
              <dd className="break-all">
                {[r.counterpartyMetadata?.name, transfers[i].counterparty].find(Boolean) ?? (isPartyId(r.counterpartyId, first.accountId) ? "" : "—")}
                {isPartyId(r.counterpartyId, first.accountId) && <span className="text-muted-foreground"> {r.counterpartyId}</span>}
              </dd>
              {transfers[i].metadata?.note ? (
                <>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd className="break-words">{String(transfers[i].metadata.note)}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Id</dt>
              <dd className="break-all font-mono text-xs text-muted-foreground">{transfers[i].id}</dd>
            </dl>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <History className="h-5 w-5 text-primary" /> History of annotations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Every version published on Nostr for this transaction, newest first. The newest one counts.</p>
        <div className="mt-4">
          <Versions versions={history[uri] ?? []} />
        </div>
        {sharedUris.map((c) =>
          (history[c] ?? []).length > 0 ? (
            <div key={c} className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">Names given to “{c}”</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This id is shared by many payments (a masked bank account or a token contract), so a name given to it is not used. Delete it if it is yours.
              </p>
              <div className="mt-2">
                <Versions versions={history[c]} />
              </div>
            </div>
          ) : null,
        )}
        {cpUris.map((c) =>
          (history[c] ?? []).length > 0 ? (
            <div key={c} className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">The counterparty</h3>
              <div className="mt-2">
                <Versions versions={history[c]} />
              </div>
            </div>
          ) : null,
        )}
      </section>
    </main>
  )
}
