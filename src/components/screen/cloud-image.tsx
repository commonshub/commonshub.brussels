"use client"

import { useEffect, useRef, useState } from "react"

/**
 * An image in the members cloud that removes itself if it fails to load (an
 * avatar Discord no longer serves). The error can fire before hydration, so
 * it is also checked once mounted.
 */
export function CloudImage({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])
  if (failed) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt="" className={className} style={style} onError={() => setFailed(true)} />
}
