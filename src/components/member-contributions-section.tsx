"use client"

import { ContributionGrid } from "./contribution-grid"
import { ContributionImages } from "./contribution-images"
import { Images } from "lucide-react"

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

interface MemberContributionsSectionProps {
  userId: string
  contributions: Contribution[]
  imagesByMonth: Record<string, any[]>
  userMap: Record<string, string | { username: string; displayName: string }>
  channelMap: Record<string, string>
  guildId: string
  selectedMonth: string | null
  onMonthSelect: (month: string | null) => void
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function MemberContributionsSection({
  userId,
  contributions,
  imagesByMonth,
  userMap,
  channelMap,
  guildId,
  selectedMonth,
  onMonthSelect,
}: MemberContributionsSectionProps) {
  // Get images for selected month or all months
  const allImages = selectedMonth
    ? imagesByMonth[selectedMonth] || []
    : Object.values(imagesByMonth)
        .flat()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Format the title
  const getTitle = () => {
    if (!selectedMonth) return "Recent contributions"

    const [year, month] = selectedMonth.split("-")
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1]
    return `Contributions in ${monthName} ${year}`
  }

  return (
    <div className="mb-6">
      <ContributionGrid userId={userId} onMonthSelect={onMonthSelect} />
      {allImages.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Images className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">{getTitle()}</h3>
            <span className="text-xs text-muted-foreground">({allImages.length})</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <ContributionImages
              imageData={allImages.slice(0, 20)}
              layout="scroll"
              userMap={userMap}
              channelMap={channelMap}
              guildId={guildId}
            />
          </div>
        </div>
      )}
    </div>
  )
}
