"use client"

import { useState } from "react"
import { HandCoins } from "lucide-react"

import { Button } from "@/components/ui/button"

/** The chip-in panel takes a lot of room: it opens on request. */
export function ContributeReveal({ intro, children, open: initiallyOpen = false }: { intro: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  if (!open) {
    return (
      <Button className="mt-4" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" />
        Contribute to this expense
      </Button>
    )
  }
  return (
    <div className="mt-6 flex flex-col gap-6">
      <p className="max-w-2xl text-muted-foreground">{intro}</p>
      {children}
    </div>
  )
}
