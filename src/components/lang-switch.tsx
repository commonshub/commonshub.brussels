"use client"

import { useOptimistic, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * EN | FR: remembers the choice in a cookie and reloads the page in that language.
 * The page takes a couple of seconds to render on the server, so the button
 * switches at once and spins until the new page is in.
 */
export function LangSwitch({ lang }: { lang: "en" | "fr" }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [shown, setShown] = useOptimistic(lang)
  const set = (l: "en" | "fr") => {
    if (l === shown) return
    try {
      document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`
    } catch {
      /* cookies blocked: the ?lang= parameter still works */
    }
    startTransition(() => {
      setShown(l)
      // A new search parameter renders the page again on the server: no refresh needed.
      router.replace(`${pathname}?lang=${l}`, { scroll: false })
    })
  }
  return (
    <div
      className="inline-flex items-center overflow-hidden rounded-full border border-border text-xs font-medium"
      role="group"
      aria-label="Language"
      aria-busy={pending}
    >
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={shown === l}
          className={`inline-flex items-center gap-1 px-2.5 py-1 uppercase transition-colors ${shown === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {pending && shown === l && <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" aria-hidden />}
          {l}
        </button>
      ))}
    </div>
  )
}
