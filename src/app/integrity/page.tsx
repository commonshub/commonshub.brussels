import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, readIntegrityIndex, readMonthIntegrity, shortHash, type MonthIntegrity } from "@/lib/integrity";

export const metadata: Metadata = {
  title: "Data integrity | Commons Hub Brussels",
  description: "Hashes of the raw data behind every monthly report, so anyone holding the same sources can verify this site's dataset.",
};

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

function Hash({ value, full = false }: { value: string; full?: boolean }) {
  return (
    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded break-all" title={value}>
      {full ? value : shortHash(value)}
    </code>
  );
}

function Providers({ manifest }: { manifest: MonthIntegrity }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {manifest.entries.map((entry) => (
            <tr key={entry.provider} className="border-t border-border/50">
              <td className="py-1.5 pr-4 font-mono text-xs whitespace-nowrap">{entry.provider}</td>
              <td className="py-1.5 pr-4 text-muted-foreground">{entry.summary}</td>
              <td className="py-1.5 pr-4 text-muted-foreground whitespace-nowrap">
                {entry.files} files · {formatBytes(entry.bytes)}
              </td>
              <td className="py-1.5 text-right">
                <Hash value={entry.hash} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * For advanced users: the sha256 of every provider's raw archive, per
 * completed month, as chb computes it. Reading the manifests reveals
 * nothing about the data; comparing them with your own chb instance
 * proves both hold the same sources.
 */
export default function IntegrityPage() {
  const index = readIntegrityIndex();
  const months = index?.months ?? [];
  const manifests = new Map(months.map((m) => [m.month, readMonthIntegrity(m.month.slice(0, 4), m.month.slice(5, 7))]));

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold">Data integrity</h1>
        <p className="text-muted-foreground">
          Every monthly report on this site is built from raw exports of our providers (bank, Stripe, accounting, calendars, Discord, the Nostr relay). Those exports are never published, but their hashes are. Anyone who holds the same sources can regenerate the hashes with{" "}
          <a href="https://github.com/commonshub/chb" className="underline underline-offset-4">
            chb
          </a>{" "}
          and check that what we report is what the sources say.
        </p>
      </div>

      {!index ? (
        <Card>
          <CardHeader>
            <CardTitle>No manifests yet</CardTitle>
            <CardDescription>The pipeline has not written an integrity manifest on this host.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How to verify</CardTitle>
              <CardDescription>
                Algorithm <code className="font-mono text-xs">{index.algorithm}</code>: each provider&apos;s JSON is canonicalised (sorted keys, fetch timestamps dropped), hashed with sha256, and the month hash covers the provider hashes. Index generated {new Date(index.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/Brussels" })}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <pre className="bg-muted rounded p-3 overflow-x-auto text-xs">
                {`chb integrity ${months[0]?.month.replace("-", "/") ?? "YYYY/MM"} --json\ncurl -s https://commonshub.brussels/api/integrity/${months[0]?.month.replace("-", "/") ?? "YYYY/MM"}`}
              </pre>
              <p className="text-muted-foreground">
                Compare provider by provider; only the providers both instances track are comparable (a mirror with an extra Odoo database adds an entry and changes the month hash, not the shared entries). Raw manifests:{" "}
                <Link href="/api/integrity" className="underline underline-offset-4">
                  /api/integrity
                </Link>{" "}
                (index) and <code className="font-mono text-xs">/api/integrity/YYYY/MM</code> (one month).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Months</CardTitle>
              <CardDescription>{months.length} completed months, newest first. Open a month for its providers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {months.map((m, i) => {
                const manifest = manifests.get(m.month);
                const [year, month] = m.month.split("-");
                return (
                  <details key={m.month} open={i === 0} className="group rounded-lg border border-border/60 px-3 py-2">
                    <summary className="cursor-pointer list-none flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold font-mono w-20">{m.month}</span>
                      <span className="text-muted-foreground">
                        {m.providers} providers · {m.files} files · {formatBytes(m.bytes)}
                      </span>
                      <span className="ml-auto">
                        <Hash value={m.hash} />
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="text-xs text-muted-foreground">
                        Month hash <Hash value={m.hash} full /> ·{" "}
                        <Link href={`/api/integrity/${year}/${month}`} className="underline underline-offset-4">
                          JSON
                        </Link>{" "}
                        ·{" "}
                        <Link href={`/${year}/${month}`} className="underline underline-offset-4">
                          report
                        </Link>
                      </div>
                      {manifest ? <Providers manifest={manifest} /> : <p className="text-xs text-muted-foreground">Manifest not readable on this host.</p>}
                    </div>
                  </details>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
