import Link from "next/link"
import type { Proposal } from "@/lib/proposals-data"
import {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
  MessageCircle,
} from "lucide-react"
import roomsData from "@/settings/rooms.json"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
}

interface Props {
  proposal: Proposal
  types: { id: string; label: string; icon: string; color: string }[]
  statuses: { id: string; label: string; color: string }[]
  isLast: boolean
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function getRoomName(slug: string): string {
  const room = roomsData.rooms.find((r: { slug?: string; id?: string; name: string }) => r.slug === slug || r.id === slug)
  return room?.name || slug
}

export function ProposalListItem({ proposal, types, statuses, isLast }: Props) {
  const type = types.find((t) => t.id === proposal.type)
  const status = statuses.find((s) => s.id === proposal.status)
  const Icon = type ? ICONS[type.icon] : MessageSquare
  const commentCount = proposal.comments.length
  const contributionCount = proposal.contributions.length

  const hasFunding = proposal.priceTotal > 0
  const fundingPercent = hasFunding ? Math.min(100, (proposal.pricePaid / proposal.priceTotal) * 100) : 0

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
        !isLast ? "border-b border-border" : ""
      }`}
    >
      {/* Icon */}
      <div
        className="mt-1 p-1.5 rounded-md flex-shrink-0"
        style={{ backgroundColor: `${type?.color}15`, color: type?.color }}
      >
        {Icon && <Icon className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground hover:text-primary text-sm">
            {proposal.title}
          </span>
          {/* Type badge */}
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: type?.color }}
          >
            {type?.label}
          </span>
          {/* Status badge */}
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
            style={{ borderColor: status?.color, color: status?.color }}
          >
            {status?.label}
          </span>
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>#{proposal.id}</span>
          <span>opened {timeAgo(proposal.createdAt)} by {proposal.author.name}</span>
          {proposal.room && (
            <span className="hidden sm:inline">📍 {getRoomName(proposal.room)}</span>
          )}
          {proposal.date && (
            <span className="hidden sm:inline">📅 {proposal.date}</span>
          )}
        </div>

        {/* Funding bar */}
        {hasFunding && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 max-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${fundingPercent}%`,
                  backgroundColor: fundingPercent >= 100 ? "#10b981" : "#f59e0b",
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {proposal.pricePaid.toLocaleString()}/{proposal.priceTotal.toLocaleString()} {proposal.token}
            </span>
          </div>
        )}
      </div>

      {/* Right side: comments + contributions count */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 mt-1">
        {contributionCount > 0 && (
          <span className="flex items-center gap-1" title={`${contributionCount} contribution(s)`}>
            <Coins className="w-3.5 h-3.5" />
            {contributionCount}
          </span>
        )}
        {commentCount > 0 && (
          <span className="flex items-center gap-1" title={`${commentCount} comment(s)`}>
            <MessageCircle className="w-3.5 h-3.5" />
            {commentCount}
          </span>
        )}
        {/* Contributor avatars */}
        <div className="flex -space-x-1.5">
          {[...new Map(
            [...proposal.contributions, ...proposal.comments]
              .map((c) => [c.author.discordId, c.author])
          ).values()]
            .slice(0, 3)
            .map((author) => (
              <img
                key={author.discordId}
                src={author.avatar}
                alt={author.name}
                className="w-5 h-5 rounded-full border border-background"
              />
            ))}
        </div>
      </div>
    </Link>
  )
}
