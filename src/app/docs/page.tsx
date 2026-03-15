import Link from "next/link";
import { CLI_COMMANDS } from "@/lib/docs";

export default function DocsPage() {
  return (
    <div>
      <h1>Documentation</h1>
      <p className="lead text-lg text-neutral-500 mb-6">
        Commons Hub Brussels tools and CLI reference.
      </p>

      <h2>CLI Tool</h2>
      <p>
        The <code>chb</code> CLI manages data for Commons Hub Brussels — syncing events,
        financial transactions, bookings, and Discord messages into a structured
        local data directory.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 my-6">
        {CLI_COMMANDS.map((cmd) => (
          <Link
            key={cmd.slug}
            href={`/docs/cli/${cmd.slug}`}
            className="block p-4 rounded-lg border border-neutral-200 hover:border-neutral-400 hover:shadow-sm transition-all"
          >
            <p className="font-mono text-sm font-medium text-neutral-900">
              chb {cmd.slug}
            </p>
            <p className="text-sm text-neutral-500 mt-1">{cmd.description}</p>
          </Link>
        ))}
      </div>

      <h2>Getting Started</h2>
      <p>
        See the <Link href="/docs/cli">CLI overview</Link> for installation
        instructions and quick start guide.
      </p>

      <h2>Source</h2>
      <p>
        The CLI is written in Go and lives in the{" "}
        <a href="https://github.com/commonshub/commonshub.brussels/tree/main/cli">
          <code>cli/</code>
        </a>{" "}
        directory of the repository.
      </p>
    </div>
  );
}
