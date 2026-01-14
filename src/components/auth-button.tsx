"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Coins } from "lucide-react"
import { useTokenBalance } from "@/hooks/use-token-balance"
import { getDisplayRoles } from "@/lib/roles"
import Link from "next/link"

export function AuthButton() {
  const { data: session, status } = useSession()
  const { balance } = useTokenBalance()

  if (status === "loading") {
    return (
      <Button variant="ghost" size="icon" disabled>
        <User className="w-5 h-5" />
      </Button>
    )
  }

  if (session) {
    const avatarUrl = session.user.avatar
      ? `https://cdn.discordapp.com/avatars/${session.user.discordId}/${session.user.avatar}.png`
      : null

    const displayRoles = getDisplayRoles(session.user.roleDetails || [])

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {session.user.username?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel>
            <div className="space-y-2">
              <p className="font-medium">{session.user.username}</p>

              {/* CHT Balance */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coins className="w-3.5 h-3.5" />
                <span>{balance !== null ? `${balance} CHT` : "Loading..."}</span>
              </div>

              {/* Roles */}
              {displayRoles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {displayRoles.map((role) => (
                    <span
                      key={role.id}
                      className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/members/${session.user.username}`}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <User className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => signIn("discord")} className="cursor-pointer">
          Login with Discord
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
