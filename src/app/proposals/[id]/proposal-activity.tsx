"use client"

import type { ProposalComment, ProposalContribution } from "@/lib/proposals-data"
import { Coins, Globe, Lock, ExternalLink } from "lucide-react"

interface Props {
  comments: ProposalComment[]
  contributions: ProposalContribution[]
  token: string
}

type ActivityItem =
  | { kind: "comment"; data: ProposalComment; sortDate: string }
  | { kind: "contribution"; data: ProposalContribution; sortDate: string }

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ProposalActivity({ comments, contributions, token }: Props) {
  // Merge and sort chronologically
  const items: ActivityItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, data: c, sortDate: c.date })),
    ...contributions.map((c) => ({ kind: "contribution" as const, data: c, sortDate: c.date })),
  ].sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime())

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No activity yet. Be the first to comment!
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        if (item.kind === "contribution") {
          const c = item.data
          return (
            <div key={`contrib-${c.id}`} className="flex items-center gap-3 py-2.5 px-4 bg-green-50 dark:bg-green-950/20 border-l-2 border-green-500">
              <Coins className="w-4 h-4 text-green-600 flex-shrink-0" />
              <img src={c.author.avatar} alt={c.author.name} className="w-5 h-5 rounded-full" />
              <span className="text-sm">
                <span className="font-medium">{c.author.name}</span>
                {" "}contributed{" "}
                <span className="font-semibold text-green-700 dark:text-green-400">
                  {c.amount.toLocaleString()} {c.token}
                </span>
              </span>
              <a
                href={`https://txinfo.xyz/tx/${c.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                tx <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <span className="text-xs text-muted-foreground ml-auto">{timeAgo(c.date)}</span>
            </div>
          )
        }

        const c = item.data as ProposalComment
        const isEncrypted = !!c.encrypted

        return (
          <div key={`comment-${c.id}`} className="border border-border rounded-lg overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
              <img src={c.author.avatar} alt={c.author.name} className="w-5 h-5 rounded-full" />
              <span className="text-sm font-medium">{c.author.name}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(c.date)}</span>
              <div className="ml-auto flex items-center gap-1">
                {isEncrypted ? (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600" title={`Encrypted for: ${c.encrypted!.for.join(", ")}`}>
                    <Lock className="w-3 h-3" />
                    {c.encrypted!.for.join(", ")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Public message">
                    <Globe className="w-3 h-3" />
                    public
                  </span>
                )}
              </div>
            </div>
            <div className="px-4 py-3">
              {isEncrypted ? (
                <p className="text-sm text-muted-foreground italic">
                  🔒 This message is encrypted for {c.encrypted!.for.join(" and ")}.
                  {" "}
                  <span className="text-xs">(Sign in to decrypt if you&apos;re a recipient)</span>
                </p>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
