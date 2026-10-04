"use client"

import type React from "react"
import { usePathname } from "next/navigation"

import { isScreenRoute } from "@/lib/screen"

/**
 * The site's header and footer around every page, except the pages made for
 * the hub's big screen (/…/screen): those fill the TV on their own, with no
 * navigation to click and no footer to scroll to.
 */
export function SiteChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  if (isScreenRoute(pathname)) return <>{children}</>
  return (
    <>
      {header}
      <main className="min-h-screen pt-16">{children}</main>
      {footer}
    </>
  )
}
