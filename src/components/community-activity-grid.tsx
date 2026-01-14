"use client"

import { useEffect, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface MonthlyActivity {
  month: string
  uniqueContributors: number
  discordContributors: number
  tokenRecipients: number
  score: number
  contributors: string[]
}

interface UserInfo {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

interface CommunityActivityData {
  monthlyActivity: MonthlyActivity[]
  firstActivityDate: string | null
  userMap: Record<string, UserInfo>
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

interface CommunityActivityGridProps {
  onMonthSelect?: (month: string | null, contributors: string[]) => void
}

export function CommunityActivityGrid({ onMonthSelect }: CommunityActivityGridProps) {
  const [data, setData] = useState<CommunityActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/community/activity`)
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError("Could not load community activity data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-3"></div>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-6 h-6 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return null
  }

  const hasActivity = data.monthlyActivity.length > 0

  if (!hasActivity) {
    return null
  }

  const activityMap = new Map(data.monthlyActivity.map((m) => [m.month, m]))

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  let startYear = currentYear
  let startMonth = 0

  if (data.firstActivityDate) {
    const firstDate = new Date(data.firstActivityDate)
    startYear = firstDate.getFullYear()
    startMonth = firstDate.getMonth()
  } else if (data.monthlyActivity.length > 0) {
    const earliest = data.monthlyActivity[0].month
    const [y, m] = earliest.split("-").map(Number)
    startYear = y
    startMonth = m - 1
  }

  const years: number[] = []
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y)
  }

  const maxScore = Math.max(...data.monthlyActivity.map((m) => m.score), 1)

  const getIntensity = (score: number): string => {
    if (score === 0) return "bg-muted"
    const ratio = score / maxScore
    if (ratio < 0.25) return "bg-primary/25"
    if (ratio < 0.5) return "bg-primary/50"
    if (ratio < 0.75) return "bg-primary/75"
    return "bg-primary"
  }

  const handleMonthClick = (monthKey: string) => {
    const newSelectedMonth = selectedMonth === monthKey ? null : monthKey
    setSelectedMonth(newSelectedMonth)

    const activity = activityMap.get(monthKey)
    const contributors = activity?.contributors || []

    if (onMonthSelect) {
      onMonthSelect(newSelectedMonth, contributors)
    }
  }

  return (
    <div className="flex justify-center">

      <TooltipProvider>
        <div className="overflow-x-auto">
          <div className="flex gap-1 mb-1 ml-12">
            {MONTH_LABELS.map((label) => (
              <div key={label} className="w-6 text-[10px] text-muted-foreground text-center">
                {label}
              </div>
            ))}
          </div>

          {years.map((year) => (
            <div key={year} className="flex gap-1 items-center mb-1">
              <div className="w-10 text-xs text-muted-foreground text-right pr-2">{year}</div>
              {MONTH_LABELS.map((_, monthIndex) => {
                const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
                const activity = activityMap.get(monthKey)
                const uniqueContributors = activity?.uniqueContributors || 0
                const discordCount = activity?.discordContributors || 0
                const tokenCount = activity?.tokenRecipients || 0
                const score = activity?.score || 0

                const isFuture = year > currentYear || (year === currentYear && monthIndex > currentMonth)
                const isBeforeStart = year < startYear || (year === startYear && monthIndex < startMonth)

                if (isFuture || isBeforeStart) {
                  return <div key={monthKey} className="w-6 h-6 rounded bg-transparent" />
                }

                const isSelected = selectedMonth === monthKey

                return (
                  <Tooltip key={monthKey}>
                    <TooltipTrigger asChild>
                      <button
                        className={`w-6 h-6 rounded cursor-pointer transition-all ${getIntensity(score)} ${
                          isSelected ? "ring-2 ring-primary ring-offset-2" : ""
                        }`}
                        aria-label={`${MONTH_LABELS[monthIndex]} ${year}: ${uniqueContributors} contributors`}
                        onClick={() => handleMonthClick(monthKey)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <p className="font-medium">
                          {MONTH_LABELS[monthIndex]} {year}
                        </p>
                        {score > 0 ? (
                          <p className="text-sm font-semibold mt-1">
                            {uniqueContributors} contributor{uniqueContributors !== 1 ? "s" : ""}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">No activity</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}
