"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface MemberCardData {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  tokensReceived?: number;
  tokensSpent?: number;
  address?: string | null;
  description?: string;
  roles?: string[];
  introductions?: Array<{ content: string }>;
}

interface MemberCardProps {
  member: MemberCardData;
  size?: "sm" | "md" | "lg";
  showTokens?: boolean;
}

function getAvatarUrl(avatar: string | null, userId: string): string {
  const url = avatar
    ? avatar.startsWith("http")
      ? avatar
      : `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function MemberCard({ member, size = "md", showTokens = true }: MemberCardProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: {
      container: "p-2",
      avatar: "w-12 h-12",
      name: "text-xs",
      tokens: "text-[10px]",
    },
    md: {
      container: "p-3",
      avatar: "w-16 h-16",
      name: "text-sm",
      tokens: "text-xs",
    },
    lg: {
      container: "p-4",
      avatar: "w-20 h-20",
      name: "text-base",
      tokens: "text-sm",
    },
  };

  const classes = sizeClasses[size];
  const displayName = member.displayName || member.username;
  const hasTokenActivity =
    showTokens &&
    ((member.tokensReceived !== undefined && member.tokensReceived > 0) ||
      (member.tokensSpent !== undefined && member.tokensSpent > 0));

  // Get introduction/description
  const introduction =
    member.description ||
    (member.introductions && member.introductions.length > 0
      ? member.introductions[0].content
      : null);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link
          href={`/members/${member.username}`}
          className={`flex flex-col items-center gap-2 ${classes.container} rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group`}
        >
          <div className={`relative ${classes.avatar} rounded-full overflow-hidden bg-muted`}>
            {!imageError ? (
              <Image
                src={getAvatarUrl(member.avatar, member.id)}
                alt={displayName}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Avatar className={classes.avatar}>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="text-center w-full space-y-1">
            <p className={`${classes.name} font-medium truncate px-1`}>{displayName}</p>
            {hasTokenActivity && (
              <div className={`flex items-center justify-center gap-2 ${classes.tokens}`}>
                {member.tokensReceived !== undefined && member.tokensReceived > 0 && (
                  <span className="text-green-600">+{Math.round(member.tokensReceived)}</span>
                )}
                {member.tokensSpent !== undefined && member.tokensSpent > 0 && (
                  <span className="text-orange-600">-{Math.round(member.tokensSpent)}</span>
                )}
              </div>
            )}
            {showTokens &&
              !hasTokenActivity &&
              (member.tokensReceived !== undefined || member.tokensSpent !== undefined) && (
                <span className={`${classes.tokens} text-muted-foreground/50`}>0</span>
              )}
          </div>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="center">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <Avatar className="w-12 h-12">
              <AvatarImage src={getAvatarUrl(member.avatar, member.id)} alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div>
              <h4 className="text-sm font-semibold truncate">{displayName}</h4>
              <p className="text-xs text-muted-foreground">@{member.username}</p>
            </div>

            {introduction && (
              <p className="text-xs text-muted-foreground line-clamp-3">{introduction}</p>
            )}

            {member.roles && member.roles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {member.roles.map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {role}
                  </Badge>
                ))}
              </div>
            )}

            {hasTokenActivity && (
              <div className="pt-1 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Tokens:</span>
                  <div className="flex items-center gap-2">
                    {member.tokensReceived !== undefined && member.tokensReceived > 0 && (
                      <span className="text-green-600 font-medium">
                        +{Math.round(member.tokensReceived)}
                      </span>
                    )}
                    {member.tokensSpent !== undefined && member.tokensSpent > 0 && (
                      <span className="text-orange-600 font-medium">
                        -{Math.round(member.tokensSpent)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-primary font-medium pt-1">Click to view profile →</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
