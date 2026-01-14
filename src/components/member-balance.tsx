"use client"

import { useEffect, useState } from "react"
import { Coins } from "lucide-react"

interface TokenData {
  walletAddress: string | null
  balance: number
  symbol: string
}

interface MemberBalanceProps {
  userId: string
}

export function MemberBalance({ userId }: MemberBalanceProps) {
  const [data, setData] = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/member/${userId}/tokens`)
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [userId])

  if (loading || !data || !data.walletAddress) {
    return null
  }

  return (
    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
      <Coins className="w-4 h-4" />
      <span>
        Balance: <span className="font-semibold text-foreground">{data.balance.toLocaleString()} {data.symbol}</span>
      </span>
    </div>
  )
}
