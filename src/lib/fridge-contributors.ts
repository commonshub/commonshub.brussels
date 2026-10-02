import Stripe from "stripe"

/**
 * Who offered a crate to the community and asked to be listed: the names
 * given at checkout, read back from Stripe so only payments that went
 * through count. Newest first, one entry per name.
 */
export interface CrateContributor {
  name: string
  drink: string
  date: string
}

const TTL_MS = 10 * 60 * 1000
let cache: { at: number; list: CrateContributor[] } | null = null

export async function loadCrateContributors(): Promise<CrateContributor[]> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return []
  if (cache && Date.now() - cache.at < TTL_MS) return cache.list
  try {
    const stripe = new Stripe(secretKey)
    const result = await stripe.paymentIntents.search({
      query: "metadata['kind']:'fridge' AND metadata['crate']:'yes' AND status:'succeeded'",
      limit: 100,
    })
    const seen = new Set<string>()
    const list: CrateContributor[] = []
    for (const intent of [...result.data].sort((a, b) => b.created - a.created)) {
      const name = intent.metadata?.name?.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      list.push({ name, drink: intent.metadata?.drink ?? "", date: new Date(intent.created * 1000).toISOString().slice(0, 10) })
    }
    cache = { at: Date.now(), list }
    return list
  } catch (error) {
    console.error("[fridge] could not list crate contributors:", error)
    return cache?.list ?? []
  }
}
