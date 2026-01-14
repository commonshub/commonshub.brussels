"use client";

import { forwardRef } from "react";
import { Star } from "lucide-react";
import { ReactionButton, ReactionButtonHandle } from "./reaction-button";

interface FavoriteButtonProps {
  channelId?: string;
  messageId?: string;
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>;
  className?: string;
  variant?: "ghost" | "default" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export interface FavoriteButtonHandle {
  toggleStar: () => void;
}

export const FavoriteButton = forwardRef<
  FavoriteButtonHandle,
  FavoriteButtonProps
>(
  (
    {
      channelId,
      messageId,
      reactions = [],
      className = "",
      variant = "ghost",
      size = "icon",
    },
    ref
  ) => {
    return (
      <ReactionButton
        ref={ref as React.Ref<ReactionButtonHandle>}
        channelId={channelId}
        messageId={messageId}
        emoji="⭐"
        reactions={reactions}
        icon={Star}
        className={className}
        variant={variant}
        size={size}
        activeColor="text-yellow-400"
        requireMemberRole={true}
      />
    );
  }
);

FavoriteButton.displayName = "FavoriteButton";
