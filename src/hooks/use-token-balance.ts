import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const CACHE_DURATION = 60 * 1000; // 1 minute

interface CacheEntry {
  balance: number;
  timestamp: number;
}

// In-memory cache shared across all hook instances
const balanceCache = new Map<string, CacheEntry>();

/**
 * Hook to fetch user's CHT (Commons Hub Token) balance
 * Calls the same API endpoint used by the profile page
 * Caches results for 1 minute to reduce API calls
 */
export function useTokenBalance() {
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.discordId) {
      setBalance(null);
      setLoading(false);
      return;
    }

    const discordId = session.user.discordId;
    const cacheKey = `balance:${discordId}`;
    const cached = balanceCache.get(cacheKey);
    const now = Date.now();

    // Return cached value if still fresh
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      setBalance(cached.balance);
      setLoading(false);
      return;
    }

    // Fetch fresh data
    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/member/${discordId}/tokens`);
        if (!res.ok) {
          throw new Error("Failed to fetch token balance");
        }

        const data = await res.json();
        const newBalance = data.balance || 0;

        // Update cache
        balanceCache.set(cacheKey, {
          balance: newBalance,
          timestamp: Date.now(),
        });

        setBalance(newBalance);
        setLoading(false);
      } catch (error) {
        console.error("[useTokenBalance] Error fetching balance:", error);
        // On error, use cached value if available
        if (cached) {
          setBalance(cached.balance);
        } else {
          setBalance(0);
        }
        setLoading(false);
      }
    };

    fetchBalance();
  }, [session?.user?.discordId]);

  return { balance, loading };
}
