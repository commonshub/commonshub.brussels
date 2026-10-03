import type { Metadata } from "next";
import Link from "next/link";

import { MarkdownDocument } from "@/components/markdown-document";
import { changelogIntro, entryMarkdown, OPENDATA_CHANGELOG } from "@/lib/opendata-changelog";

const BASE_URL = "https://commonshub.brussels";

export const metadata: Metadata = {
  title: "Open data changelog | Commons Hub Brussels",
  description: "What is new or has changed in the Commons Hub Brussels open dataset.",
  alternates: {
    types: {
      "text/markdown": `${BASE_URL}/opendata/changelog.md`,
      "application/atom+xml": `${BASE_URL}/opendata/changelog.xml`,
    },
  },
};

/** The open-data changelog, for people; agents read /opendata/changelog.md, .json or the Atom feed. */
export default function OpenDataChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/opendata" className="text-muted-foreground underline-offset-2 hover:underline">
          ← Open data
        </Link>
        <span className="ml-auto text-muted-foreground">Also as</span>
        {[
          ["changelog.md", "/opendata/changelog.md"],
          ["changelog.json", "/opendata/changelog.json"],
          ["Atom feed", "/opendata/changelog.xml"],
        ].map(([label, href]) => (
          <a key={href} href={href} className="rounded-md border border-border px-2 py-1 font-mono text-xs text-foreground hover:border-primary">
            {label}
          </a>
        ))}
      </div>
      <MarkdownDocument markdown={changelogIntro(BASE_URL)} />
      {/* One section per entry, so each can be linked: /opendata/changelog#annual-accounts */}
      {OPENDATA_CHANGELOG.map((e) => (
        <section key={e.id} id={e.id} className="scroll-mt-24">
          <MarkdownDocument markdown={entryMarkdown(e, BASE_URL)} />
        </section>
      ))}
    </div>
  );
}
