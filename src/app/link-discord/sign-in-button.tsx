"use client"

import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"

export function DiscordSignInButton() {
  return (
    <Button size="lg" onClick={() => signIn("discord", { callbackUrl: window.location.href })}>
      Sign in with Discord
    </Button>
  )
}
