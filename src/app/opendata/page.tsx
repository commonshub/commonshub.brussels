import type { Metadata } from "next";
import Link from "next/link";
import { MarkdownDocument } from "@/components/markdown-document";

import { opendataSkill } from "@/lib/opendata-skill";

// The skill embeds the data-quality section, generated from the dataset.
export const dynamic = "force-dynamic";

const BASE_URL = "https://commonshub.brussels";

export const metadata: Metadata = {
  title: "Open data | Commons Hub Brussels",
  description:
    "The Hub's books in the open: transactions, expenses line by line, vendors, customers, room bookings, events and VAT returns, as a read-only JSON API under the ODbL.",
  alternates: { types: { "text/markdown": `${BASE_URL}/opendata.md` } },
};

/** Drop the YAML front matter: it is for agents loading the skill. */
const withoutFrontMatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n+/, "");


/**
 * The open-data skill, for people: the same text agents get at /opendata.md
 * and /opendata/SKILL.md, rendered on the server (no client JavaScript).
 */
export default function OpenDataPage() {
  const markdown = withoutFrontMatter(opendataSkill(BASE_URL));
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">For agents and scripts:</span>
        {[
          ["opendata.md", "/opendata.md"],
          ["changelog", "/opendata/changelog"],
          ["index.json", "/opendata/index.json"],
          ["monthly.json", "/opendata/monthly.json"],
          ["llms.txt", "/llms.txt"],
        ].map(([label, href]) => (
          <Link key={href} href={href} prefetch={false} className="rounded-md border border-border px-2 py-1 font-mono text-xs text-foreground hover:border-primary">
            {label}
          </Link>
        ))}
      </div>
      <MarkdownDocument markdown={markdown} />
    </div>
  );
}
