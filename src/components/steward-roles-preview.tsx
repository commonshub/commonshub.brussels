"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "@/components/optimized-image"
import { Coins, Users, ArrowRight } from "lucide-react"
import roles from "@/settings/roles.json"

interface RoleMember {
  id: string
  username: string
  displayName: string
  avatar: string | null
}

interface RoleWithMembers {
  id: string
  name: string
  amountToMint: number
  frequency: string
  members: RoleMember[]
}

export function StewardRolesPreview() {
  const [rolesWithMembers, setRolesWithMembers] = useState<RoleWithMembers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRoleMembers() {
      // Filter roles that earn tokens (amountToMint > 0)
      const earningRoles = roles.filter((role) => role.amountToMint > 0)

      const rolesData = await Promise.all(
        earningRoles.map(async (role) => {
          try {
            const res = await fetch(`/api/discord/role-members?roleId=${role.id}`)
            const data = await res.json()
            return {
              ...role,
              members: data.members || [],
            }
          } catch {
            return { ...role, members: [] }
          }
        }),
      )

      // Only show roles that have at least one member, sorted by tokens earned
      const filledRoles = rolesData
        .filter((role) => role.members.length > 0)
        .sort((a, b) => b.amountToMint - a.amountToMint)
        .slice(0, 6) // Show top 6 for preview

      setRolesWithMembers(filledRoles)
      setLoading(false)
    }

    fetchRoleMembers()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-muted/50 rounded-xl p-6 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  if (rolesWithMembers.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rolesWithMembers.map((role) => (
          <div key={role.id} className="bg-background rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-foreground">{role.name}</h3>
              <div className="flex items-center gap-1 text-primary font-medium">
                <Coins className="w-4 h-4" />
                <span>{role.amountToMint}</span>
                <span className="text-xs text-muted-foreground">/{role.frequency.slice(0, 2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {role.members.slice(0, 4).map((member) => (
                  <div
                    key={member.id}
                    className="w-8 h-8 rounded-full border-2 border-background overflow-hidden bg-muted"
                  >
                    {member.avatar ? (
                      <Image
                        src={member.avatar || "/placeholder.svg"}
                        alt={member.displayName}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {role.members.length > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                    +{role.members.length - 4}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link
          href="/stewards"
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
        >
          View all steward positions
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
