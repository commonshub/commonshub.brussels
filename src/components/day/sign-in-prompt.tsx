"use client"

import { signIn } from "next-auth/react"
import { LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SignInPrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <span>{children}</span>
      <Button size="sm" variant="outline" onClick={() => signIn("discord")}>
        <LogIn className="h-4 w-4" />
        Log in with Discord
      </Button>
    </div>
  )
}
