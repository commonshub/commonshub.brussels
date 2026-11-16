"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

/**
 * On a page served from the cache, the layout rendered without anyone's
 * session: fetch the visitor's own after load so the header shows them signed in.
 */
export function RefreshSession() {
  const { update } = useSession()
  useEffect(() => {
    update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
