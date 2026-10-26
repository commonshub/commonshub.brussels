"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { isFullScreenPage } from "@/lib/member-pages-bridge"
import { isScreenRoute } from "@/lib/screen"
import settings from "@/settings/settings.json"

/**
 * The site's header and footer around every page, except the pages made for
 * the hub's big screen (/…/screen): those fill the TV on their own, with no
 * navigation to click and no footer to scroll to. Members' pages in full
 * screen (/members/<u>/<slug>.html, /<alias>.html) fill the window too.
 * A member's dashboard (/ once signed in) has its own short footer.
 * On the TV's screens the mouse pointer is hidden: nobody uses it there.
 */
export function SiteChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  // Slide decks (/token/slides) fill the window too.
  if (isScreenRoute(pathname) && !pathname?.startsWith("/tablet"))
    return (
      <>
        <style>{"*, *::before, *::after { cursor: none !important; }"}</style>
        {children}
      </>
    )
  if (isScreenRoute(pathname) || isFullScreenPage(pathname) || pathname?.endsWith("/slides")) return <>{children}</>
  const dashboard = pathname === "/" && (status === "loading" || !!session?.user?.roles?.includes(settings.discord.roles.member))
  return (
    <>
      {header}
      <main className="min-h-screen pt-16">{children}</main>
      {!dashboard && footer}
    </>
  )
}
