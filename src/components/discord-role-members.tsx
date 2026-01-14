"use client"

import { useEffect, useState, useMemo } from "react"
import { MemberCard } from "@/components/member-card"
import settings from "@/settings/settings.json"

interface RoleMember {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

interface RoleMembersData {
  members: RoleMember[]
}

interface DiscordRoleMembersProps {
  roleId?: string
}

export function DiscordRoleMembers({ roleId = settings.discord.roles.member }: DiscordRoleMembersProps) {
  const [data, setData] = useState<RoleMembersData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRoleMembers() {
      try {
        const response = await fetch(`/api/discord/role-members?roleId=${roleId}`)
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error("Failed to fetch role members:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRoleMembers()
  }, [roleId])

  // Filter members: only show those with avatars and not bots
  const { displayedMembers, hiddenCount } = useMemo(() => {
    if (!data || !data.members) {
      return { displayedMembers: [], hiddenCount: 0 }
    }

    const totalMembers = data.members
    // Filter: must have avatar and not be a bot (bots typically have discriminator ending in #0000 or username patterns)
    const visibleMembers = totalMembers.filter(
      (member) =>
        member.avatar && // Must have avatar
        !member.username.toLowerCase().includes('bot') && // Simple bot detection
        member.displayName !== 'Deleted User' // Filter out deleted users
    )

    return {
      displayedMembers: visibleMembers,
      hiddenCount: totalMembers.length - visibleMembers.length
    }
  }, [data])

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

  if (!data || !data.members) return null

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
        {displayedMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={{
              id: member.id,
              username: member.username,
              displayName: member.displayName,
              avatar: member.avatar,
            }}
            size="sm"
            showTokens={false}
          />
        ))}

        {hiddenCount > 0 && (
          <div className="flex flex-col items-center gap-2 p-2">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">+{hiddenCount}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">more</p>
          </div>
        )}
      </div>
    </div>
  )
}
