import Link from "next/link"
import Image from "@/components/optimized-image"

interface ContributorCardProps {
  id: string
  username: string
  displayName: string
  avatar: string | null
  tokensReceived?: number
  tokensSpent?: number
}

function getAvatarUrl(avatar: string | null, userId: string): string {
  const url = avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/0.png`
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

export function ContributorCard({
  id,
  username,
  displayName,
  avatar,
  tokensReceived,
  tokensSpent
}: ContributorCardProps) {
  return (
    <Link
      href={`/members/${username}`}
      className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted">
        <Image
          src={getAvatarUrl(avatar, id)}
          alt={displayName}
          fill
          className="object-cover"
        />
      </div>
      <div className="text-center w-full space-y-1">
        <p className="text-sm font-medium truncate px-1">
          {displayName}
        </p>
        {(tokensReceived !== undefined || tokensSpent !== undefined) && (
          <div className="flex items-center justify-center gap-2 text-xs">
            {tokensReceived !== undefined && tokensReceived > 0 && (
              <span className="text-green-600">
                +{tokensReceived} tokens
              </span>
            )}
            {tokensSpent !== undefined && tokensSpent > 0 && (
              <span className="text-orange-600">
                -{tokensSpent} tokens
              </span>
            )}
            {(!tokensReceived || tokensReceived === 0) && (!tokensSpent || tokensSpent === 0) && (
              <span className="text-muted-foreground/50">0 tokens</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
