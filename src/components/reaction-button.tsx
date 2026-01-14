"use client";

import { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import settings from "@/settings/settings.json";

interface ReactionButtonProps {
  channelId?: string;
  messageId?: string;
  emoji: string;
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>;
  icon: React.ComponentType<{ className?: string; fill?: string }>;
  className?: string;
  variant?: "ghost" | "default" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  activeColor?: string;
  requireMemberRole?: boolean;
}

export interface ReactionButtonHandle {
  toggleReaction: () => void;
}

export const ReactionButton = forwardRef<
  ReactionButtonHandle,
  ReactionButtonProps
>(
  (
    {
      channelId,
      messageId,
      emoji,
      reactions = [],
      icon: Icon,
      className = "",
      variant = "ghost",
      size = "icon",
      activeColor = "text-yellow-400",
      requireMemberRole = true,
    },
    ref
  ) => {
    const { data: session, status } = useSession();
    const [optimisticReacted, setOptimisticReacted] = useState<boolean | null>(
      null
    );
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

    // Check if user has Member role (if required)
    const memberRoleId = settings.discord.roles.member;
    const userRoles = session?.user?.roles || [];
    const hasMemberRole = userRoles.includes(memberRoleId);
    const hasPermission = !requireMemberRole || hasMemberRole;

    // Reset optimistic state when message changes
    useEffect(() => {
      setOptimisticReacted(null);
      setOptimisticCount(null);
    }, [messageId]);

    const reaction = reactions.find((r) => r.emoji === emoji);
    const currentlyReacted = optimisticReacted ?? reaction?.me ?? false;
    const currentCount = optimisticCount ?? reaction?.count ?? 0;

    const handleReaction = useCallback(async () => {
      if (
        status !== "authenticated" ||
        !session ||
        !messageId ||
        !channelId ||
        !hasPermission
      ) {
        return;
      }

      // Optimistic updates
      setOptimisticReacted(!currentlyReacted);
      setOptimisticCount(
        currentlyReacted ? Math.max(0, currentCount - 1) : currentCount + 1
      );

      try {
        const response = await fetch("/api/discord/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId,
            messageId,
            emoji,
            add: !currentlyReacted,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update reaction");
        }
      } catch (error) {
        console.error(`Error updating ${emoji} reaction:`, error);
        // Revert optimistic updates on error
        setOptimisticReacted(currentlyReacted);
        setOptimisticCount(currentCount);
      }
    }, [
      status,
      session,
      messageId,
      channelId,
      hasPermission,
      currentlyReacted,
      currentCount,
      emoji,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        toggleReaction: handleReaction,
      }),
      [handleReaction]
    );

    const isDisabled =
      status !== "authenticated" || !session || !messageId || !channelId || !hasPermission;
    const isFilled = currentCount > 0;

    return (
      <Button
        variant={variant}
        size={size}
        className={`transition-all duration-150 active:scale-90 !pointer-events-auto ${
          currentlyReacted ? activeColor : ""
        } ${
          isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDisabled) {
            handleReaction();
          }
        }}
        disabled={isDisabled}
      >
        <Icon
          className="w-6 h-6 transition-transform"
          fill={isFilled ? "currentColor" : "none"}
        />
        {currentCount > 1 && (
          <span className="ml-1 text-sm font-medium">{currentCount}</span>
        )}
      </Button>
    );
  }
);

ReactionButton.displayName = "ReactionButton";
