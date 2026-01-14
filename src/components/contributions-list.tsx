"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DiscordMessage } from "@/components/discord-message"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

interface Contribution {
  content: string
  timestamp: string
  mentions: string[]
  attachments?: Array<{ id: string; url: string; proxyUrl: string; contentType?: string }>
  author?: {
    id: string
    username: string
    displayName: string
    avatar: string | null
  }
  messageId: string
  channelId?: string
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>
}

interface ContributionsListProps {
  contributions: Contribution[]
  memberId: string
  userMap: Record<string, string>
  channelMap: Record<string, string>
  guildId: string
  initialLimit?: number
  loadMoreIncrement?: number
  selectedMonth?: string | null
}

export function ContributionsList({
  contributions,
  memberId,
  userMap,
  channelMap,
  guildId,
  initialLimit = 10,
  loadMoreIncrement = 10,
  selectedMonth,
}: ContributionsListProps) {
  const [visibleCount, setVisibleCount] = useState(initialLimit)

  // Filter contributions by selected month if specified
  const filteredContributions = selectedMonth
    ? contributions.filter((contribution) => {
        const date = new Date(contribution.timestamp)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        return monthKey === selectedMonth
      })
    : contributions

  // Reset visible count when selected month changes
  useEffect(() => {
    setVisibleCount(initialLimit)
  }, [selectedMonth, initialLimit])

  const sortedContributions = [...filteredContributions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const visibleContributions = sortedContributions.slice(0, visibleCount)
  const hasMore = visibleCount < filteredContributions.length
  const remaining = filteredContributions.length - visibleCount

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + loadMoreIncrement, filteredContributions.length))
  }

  return (
    <div className="space-y-4">
      {visibleContributions.map((contribution, index) => (
        <div key={index} className="bg-muted/50 rounded-lg p-4">
          {contribution.author && contribution.author.id !== memberId && (
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <span>Posted by</span>
              <Link
                href={`/members/${contribution.author.username}`}
                className="text-primary hover:underline font-medium"
              >
                @{contribution.author.displayName}
              </Link>
            </div>
          )}
          <DiscordMessage
            content={contribution.content}
            userMap={userMap}
            channelMap={channelMap}
            guildId={guildId}
            attachments={contribution.attachments}
            timestamp={contribution.timestamp}
          />
          <p className="text-xs text-muted-foreground mt-3">
            {new Date(contribution.timestamp).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={handleLoadMore} className="gap-2 bg-transparent">
            <ChevronDown className="w-4 h-4" />
            Load more ({remaining} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}
