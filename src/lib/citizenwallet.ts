import { createPublicClient, http, keccak256, toHex } from "viem"
import { celo } from "viem/chains"

const cardManagerModuleAbi = [
  {
    type: "function",
    name: "getCardAddress",
    inputs: [
      { name: "id", type: "bytes32", internalType: "bytes32" },
      { name: "hashedSerial", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const

const CARD_MANAGER_ADDRESS = "0xBA861e2DABd8316cf11Ae7CdA101d110CF581f28" // CHT Card Manager deployed by Citizen Wallet

export const getCardAddress = async (hashedSerial: `0x${string}`): Promise<string | null> => {
  const rpcUrl = process.env.CELO_RPC_URL || "https://forno.celo.org"

  try {
    const client = createPublicClient({
      chain: celo,
      transport: http(rpcUrl),
    })

    const hashedInstanceId = keccak256(toHex("cw-discord-1")) // instance_id of the CHT Card Manager

    const accountAddress = await client.readContract({
      address: CARD_MANAGER_ADDRESS,
      abi: cardManagerModuleAbi,
      functionName: "getCardAddress",
      args: [hashedInstanceId, hashedSerial],
    })

    console.log("[v0] citizenwallet getCardAddress result:", accountAddress)
    return accountAddress
  } catch (error) {
    console.error("Error fetching account address:", error)
    return null
  }
}

export const getAccountAddressFromDiscordUserId = async (userId: string): Promise<string | null> => {
  const hashedUserId = keccak256(toHex(userId))
  console.log("[v0] citizenwallet getAccountAddressFromDiscordUserId userId:", userId, "hashedUserId:", hashedUserId)
  const cardAddress = await getCardAddress(hashedUserId)
  console.log("[v0] citizenwallet getAccountAddressFromDiscordUserId cardAddress:", cardAddress)
  return cardAddress
}

/** The token accounts of many Discord users at once (one multicall); null where the read failed. */
export const getCardAddresses = async (userIds: string[]): Promise<Map<string, string | null>> => {
  const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org") })
  const instance = keccak256(toHex("cw-discord-1"))
  const results = await client.multicall({
    contracts: userIds.map((id) => ({ address: CARD_MANAGER_ADDRESS, abi: cardManagerModuleAbi, functionName: "getCardAddress", args: [instance, keccak256(toHex(id))] }) as const),
  })
  return new Map(userIds.map((id, i) => [id, results[i].status === "success" ? (results[i].result as string) : null]))
}

const erc20BalanceAbi = [
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const

/** A token balance read straight from Celo, in whole units (not Etherscan, whose free daily quota runs out). */
export const getTokenBalance = async (token: `0x${string}`, account: `0x${string}`, decimals: number): Promise<number> => {
  const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org") })
  const raw = await client.readContract({ address: token, abi: erc20BalanceAbi, functionName: "balanceOf", args: [account] })
  return Number(raw) / 10 ** decimals
}
