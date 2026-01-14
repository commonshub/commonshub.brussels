"use client"

import { useEffect, useState, useMemo } from "react"
import { MemberCard } from "@/components/member-card"

interface Contributor {
  id: string
  profile: {
    name: string
    username: string
    description: string | null
    avatar_url: string | null
    roles: string[]
  }
  tokens: {
    in: number
    out: number
  }
  discord: {
    messages: number
    mentions: number
  }
  address: string | null
}

interface ContributorsData {
  year: string
  month: string
  contributors: Contributor[]
}

/**
 * Display recent contributors from the current and previous month
 */
export function RecentContributors() {
  const [currentMonthData, setCurrentMonthData] = useState<ContributorsData | null>(null)
  const [previousMonthData, setPreviousMonthData] = useState<ContributorsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecentContributors() {
      try {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = String(now.getMonth() + 1).padStart(2, "0")

        // Calculate previous month
        const prevDate = new Date(now)
        prevDate.setMonth(prevDate.getMonth() - 1)
        const previousYear = prevDate.getFullYear()
        const previousMonth = String(prevDate.getMonth() + 1).padStart(2, "0")

        // Fetch current month
        try {
          const currentResponse = await fetch(`/data/${currentYear}/${currentMonth}/contributors.json`)
          if (currentResponse.ok) {
            const currentData = await currentResponse.json()
            setCurrentMonthData(currentData)
          }
        } catch (error) {
          console.warn(`Could not load contributors for ${currentYear}/${currentMonth}:`, error)
        }

        // Fetch previous month
        try {
          const previousResponse = await fetch(`/data/${previousYear}/${previousMonth}/contributors.json`)
          if (previousResponse.ok) {
            const previousData = await previousResponse.json()
            setPreviousMonthData(previousData)
          }
        } catch (error) {
          console.warn(`Could not load contributors for ${previousYear}/${previousMonth}:`, error)
        }
      } catch (error) {
        console.error("Failed to fetch recent contributors:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentContributors()
  }, [])

  // Merge and deduplicate contributors from both months
  const { displayedContributors, stats } = useMemo(() => {
    const contributorsMap = new Map<string, Contributor>()

    // Add previous month contributors first
    if (previousMonthData?.contributors) {
      for (const contributor of previousMonthData.contributors) {
        contributorsMap.set(contributor.id, contributor)
      }
    }

    // Add/overwrite with current month contributors (to get latest data)
    if (currentMonthData?.contributors) {
      for (const contributor of currentMonthData.contributors) {
        contributorsMap.set(contributor.id, contributor)
      }
    }

    const allContributors = Array.from(contributorsMap.values())

    // Filter: only show those with avatars and activity
    const visibleContributors = allContributors
      .filter(
        (contributor) =>
          contributor.profile.avatar_url && // Must have avatar
          (contributor.tokens.in > 0 || contributor.discord.messages > 0) // Must have some activity
      )
      .sort((a, b) => b.tokens.in - a.tokens.in) // Sort by tokens received

    const totalTokensReceived = visibleContributors.reduce(
      (sum, c) => sum + c.tokens.in,
      0
    )

    return {
      displayedContributors: visibleContributors,
      stats: {
        totalContributors: visibleContributors.length,
        totalTokens: totalTokensReceived,
      },
    }
  }, [currentMonthData, previousMonthData])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="h-3 w-14 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (displayedContributors.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No recent contributors found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex justify-center gap-8 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{stats.totalContributors}</span> active contributors
        </div>
        <div>
          <span className="font-medium text-foreground">{Math.round(stats.totalTokens)}</span> CHT distributed
        </div>
      </div>

      {/* Contributors Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
        {displayedContributors.map((contributor) => (
          <MemberCard
            key={contributor.id}
            member={{
              id: contributor.id,
              username: contributor.profile.username,
              displayName: contributor.profile.name,
              avatar: contributor.profile.avatar_url,
            }}
            size="sm"
            showTokens={true}
            tokensReceived={contributor.tokens.in}
          />
        ))}
      </div>
    </div>
  )
}
