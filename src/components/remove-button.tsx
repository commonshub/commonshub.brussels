"use client";

import { forwardRef } from "react";
import { X } from "lucide-react";
import { ReactionButton, ReactionButtonHandle } from "./reaction-button";

interface RemoveButtonProps {
  channelId?: string;
  messageId?: string;
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>;
  className?: string;
  variant?: "ghost" | "default" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export interface RemoveButtonHandle {
  toggleRemove: () => void;
}

export const RemoveButton = forwardRef<
  RemoveButtonHandle,
  RemoveButtonProps
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
        emoji="❌"
        reactions={reactions}
        icon={X}
        className={className}
        variant={variant}
        size={size}
        activeColor="text-red-500"
        requireMemberRole={false}
      />
    );
  }
);

RemoveButton.displayName = "RemoveButton";
