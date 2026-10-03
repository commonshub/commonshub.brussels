import { AlertTriangle, FileText, Info } from "lucide-react";

import { documentHref, KEY_FIGURE_ROWS, type FiscalYear } from "@/lib/annual-accounts";

const eur = (n: number) => new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const DOC_LABELS: Record<string, string> = { "balance-sheet": "Balance sheet", "profit-and-loss": "Profit and loss" };

/**
 * One fiscal year's filed accounts: key figures, the filed statements, and
 * chb's consistency checks shown as a visible note (never hidden).
 */
export function AnnualAccounts({ fy }: { fy: FiscalYear }) {
  const rows = KEY_FIGURE_ROWS.filter((r) => typeof fy.keyFigures[r.key] === "number");
  const issues = fy.checks.filter((c) => c.level !== "info");
  const infos = fy.checks.filter((c) => c.level === "info");
  const multiYear = fy.period.months !== 12 || !fy.period.start.endsWith("-01-01");

  return (
    <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-semibold text-foreground">Annual accounts {fy.label}</h3>
        <p className="text-sm text-muted-foreground">
          {day(fy.period.start)} – {day(fy.period.end)}
          {multiYear ? ` (${fy.period.months} months)` : ""}
        </p>
      </header>
      <p className="mt-1 text-sm text-muted-foreground">
        Filed with the National Bank of Belgium{fy.filedAt ? ` on ${day(fy.filedAt)}` : ""}, abbreviated schema for associations.{" "}
        {fy.nbb?.url && (
          <a href={fy.nbb.url} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            NBB record
          </a>
        )}
      </p>

      {issues.length > 0 && (
        <div role="note" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" /> These accounts have known inconsistencies
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {issues.map((c) => (
              <li key={c.code}>{c.message}</li>
            ))}
          </ul>
          <p className="mt-2">An accounting review is under way. Corrections will be published here.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
          {(["balance", "result"] as const).map((group) => (
            <table key={group} className="w-full text-sm">
              <caption className="pb-1 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group === "balance" ? `Balance sheet at ${day(fy.period.end)}` : "Profit and loss"}
              </caption>
              <tbody>
                {rows
                  .filter((r) => r.group === group)
                  .map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 text-foreground">
                        {r.label} <span className="text-xs text-muted-foreground">{r.code}</span>
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${(fy.keyFigures[r.key] ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {eur(fy.keyFigures[r.key]!)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {fy.documents.map((d) => (
          <a key={d.path} href={documentHref(d)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary">
            <FileText className="h-4 w-4" /> {DOC_LABELS[d.kind] ?? d.file} (PDF)
          </a>
        ))}
        <a href={`/opendata/${fy.year}/annual-accounts.json`} className="inline-flex items-center rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground hover:border-primary">
          annual-accounts.json
        </a>
        <a href={`/opendata/${fy.year}/ledger-balances.json`} className="inline-flex items-center rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground hover:border-primary">
          ledger-balances.json
        </a>
      </div>

      {infos.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {infos.map((c) => (
            <li key={c.code} className="flex gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.message}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** The filed accounts whose period ends in a year: the last section of the year report (inside its container). */
export function AnnualAccountsSection({ fiscalYears }: { fiscalYears: FiscalYear[] }) {
  if (fiscalYears.length === 0) return null;
  return (
    <section id="annual-accounts" className="scroll-mt-24 space-y-4">
      <h2 className="text-2xl font-bold">Annual accounts</h2>
      <div className="space-y-6">
        {fiscalYears.map((fy) => (
          <AnnualAccounts key={fy.label} fy={fy} />
        ))}
      </div>
    </section>
  );
}
