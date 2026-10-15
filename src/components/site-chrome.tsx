"use client"

import type React from "react"
import { usePathname } from "next/navigation"

import { isFullScreenPage } from "@/lib/member-pages-bridge"
import { isScreenRoute } from "@/lib/screen"

/**
 * The site's header and footer around every page, except the pages made for
 * the hub's big screen (/…/screen): those fill the TV on their own, with no
 * navigation to click and no footer to scroll to. Members' pages in full
 * screen (/members/<u>/<slug>.html, /<alias>.html) fill the window too.
 */
export function SiteChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  if (isScreenRoute(pathname) || isFullScreenPage(pathname)) return <>{children}</>
  return (
    <>
      {header}
      <main className="min-h-screen pt-16">{children}</main>
      {footer}
    </>
  )
}
