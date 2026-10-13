import { createPublicClient, erc20Abi, http } from "viem"
import { celo } from "viem/chains"

import settings from "@/settings/settings.json"
import { getAccountAddressFromDiscordUserId } from "./citizenwallet"

/** A Discord member's community tokens (their Citizen Wallet account on Celo); 0 without a wallet. */
export async function tokenBalanceOf(discordId: string): Promise<number> {
  const address = await getAccountAddressFromDiscordUserId(discordId)
  if (!address || /^0x0+$/.test(address)) return 0
  const token = settings.contributionToken
  const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || token.rpcUrl) })
  const raw = await client.readContract({ address: token.address as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] })
  return Number(raw) / 10 ** token.decimals
}
