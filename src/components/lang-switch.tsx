"use client"

import { usePathname, useRouter } from "next/navigation"

/** EN | FR: remembers the choice in a cookie and reloads the page in that language. */
export function LangSwitch({ lang }: { lang: "en" | "fr" }) {
  const router = useRouter()
  const pathname = usePathname()
  const set = (l: "en" | "fr") => {
    try {
      document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`
    } catch {
      /* cookies blocked: the ?lang= parameter still works */
    }
    router.replace(`${pathname}?lang=${l}`)
    router.refresh()
  }
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-border text-xs font-medium" role="group" aria-label="Language">
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 uppercase ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
