"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { MemberIntroduction } from "@/components/member-introduction"
import { MemberContributionsSection } from "@/components/member-contributions-section"
import { ContributionsList } from "@/components/contributions-list"

interface Contributor {
  id: string
  username: string
  displayName: string
  avatar: string | null
  contributionCount: number
  joinedAt: string | null
}

interface Introduction {
  content: string
  timestamp: string
  attachments?: Array<{
    id: string
    url: string
    proxyUrl: string
    contentType?: string
  }>
}

interface Contribution {
  content: string
  timestamp: string
  mentions: string[]
  attachments?: Array<{
    id: string
    url: string
    proxyUrl: string
    contentType?: string
  }>
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

interface MemberProfileContentProps {
  member: Contributor
  resolvedIntroductions: Introduction[]
  resolvedContributions: Contribution[]
  totalContributions: number
  imagesByMonth: Record<string, any[]>
  userMap: Record<string, string>
  channelMap: Record<string, string>
  guildId: string
}

export function MemberProfileContent({
  member,
  resolvedIntroductions,
  resolvedContributions,
  totalContributions,
  imagesByMonth,
  userMap,
  channelMap,
  guildId,
}: MemberProfileContentProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  return (
    <>
      <MemberIntroduction
        introductions={resolvedIntroductions}
        userMap={userMap}
        channelMap={channelMap}
        guildId={guildId}
      />

      {resolvedContributions.length > 0 && (
        <div className="border-t border-border pt-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Contributions ({totalContributions})
            </h2>
          </div>

          <MemberContributionsSection
            userId={member.id}
            contributions={resolvedContributions}
            imagesByMonth={imagesByMonth}
            userMap={userMap}
            channelMap={channelMap}
            guildId={guildId}
            selectedMonth={selectedMonth}
            onMonthSelect={setSelectedMonth}
          />

          <ContributionsList
            contributions={resolvedContributions}
            memberId={member.id}
            userMap={userMap}
            channelMap={channelMap}
            guildId={guildId}
            initialLimit={10}
            loadMoreIncrement={10}
            selectedMonth={selectedMonth}
          />
        </div>
      )}
    </>
  )
}
