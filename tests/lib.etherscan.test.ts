/**
 * Etherscan API Tests
 * Tests the Etherscan helper functions for fetching token balances and transfers
 */

import { describe, test, expect, jest, beforeEach, afterAll } from "@jest/globals"
import { fetchTokenBalance, fetchTokenTransfers, parseTokenBalance, parseTokenValue } from "../src/lib/etherscan"
import settings from "../src/settings/settings.json"

describe("Etherscan API", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetModules()
    // Ensure fetch is available after resetModules
    if (typeof global.fetch === "undefined" && originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  describe("fetchTokenBalance", () => {
    test("fetches token balance successfully", async () => {
      const savingsAccount = settings.finance.accounts.find((a) => a.slug === "savings")

      if (
        !savingsAccount ||
        savingsAccount.provider !== "etherscan" ||
        !savingsAccount.chainId ||
        !savingsAccount.token
      ) {
        throw new Error("Savings account not found or not etherscan")
      }

      const apiKey = process.env.ETHERSCAN_API_KEY
      if (!apiKey) {
        throw new Error("ETHERSCAN_API_KEY not set in test environment")
      }

      const result = await fetchTokenBalance(
        savingsAccount.chainId,
        savingsAccount.token.address,
        savingsAccount.address,
        apiKey,
      )

      const balance = parseTokenBalance(result.result, savingsAccount.token.decimals)
      expect(balance).toBeGreaterThan(0)
    })
  })

  describe("fetchTokenTransfers", () => {
    test("fetches token transfers successfully", async () => {
      const savingsAccount = settings.finance.accounts.find((a) => a.slug === "savings")

      if (
        !savingsAccount ||
        savingsAccount.provider !== "etherscan" ||
        !savingsAccount.chainId ||
        !savingsAccount.token
      ) {
        throw new Error("Savings account not found or not etherscan")
      }

      const apiKey = process.env.ETHERSCAN_API_KEY
      if (!apiKey) {
        throw new Error("ETHERSCAN_API_KEY not set in test environment")
      }

      const result = await fetchTokenTransfers(
        savingsAccount.chainId,
        savingsAccount.token.address,
        savingsAccount.address,
        apiKey,
      )

      expect(result.result[0].tokenSymbol).toBe(savingsAccount.token.symbol)
      expect(result.result[0].contractAddress.toLowerCase()).toBe(savingsAccount.token.address.toLowerCase())
      expect(result.result.length).toBeGreaterThan(10)
    })
  })

  describe("parseTokenBalance", () => {
    test("parses token balance with 18 decimals", () => {
      const rawBalance = "1000000000000000000" // 1 token
      const decimals = 18
      const result = parseTokenBalance(rawBalance, decimals)
      expect(result).toBe(1)
    })

    test("parses token balance with 6 decimals", () => {
      const rawBalance = "1000000" // 1 token
      const decimals = 6
      const result = parseTokenBalance(rawBalance, decimals)
      expect(result).toBe(1)
    })

    test("handles zero balance", () => {
      const rawBalance = "0"
      const decimals = 18
      const result = parseTokenBalance(rawBalance, decimals)
      expect(result).toBe(0)
    })

    test("handles empty string", () => {
      const rawBalance = ""
      const decimals = 18
      const result = parseTokenBalance(rawBalance, decimals)
      expect(result).toBe(0)
    })
  })

  describe("parseTokenValue", () => {
    test("parses token value with 18 decimals", () => {
      const rawValue = "500000000000000000" // 0.5 tokens
      const decimals = 18
      const result = parseTokenValue(rawValue, decimals)
      expect(result).toBe(0.5)
    })

    test("parses token value with 6 decimals", () => {
      const rawValue = "500000" // 0.5 tokens
      const decimals = 6
      const result = parseTokenValue(rawValue, decimals)
      expect(result).toBe(0.5)
    })
  })

  describe("CHT Token on Celo", () => {
    const CHT_TOKEN_ADDRESS = "0x65dd32834927de9e57e72a3e2130a19f81c6371d"
    const TEST_WALLET_ADDRESS = "0xa6f29e8afDd08D518DF119e08C1d1AFB3730871D"
    const CELO_CHAIN_ID = 42220

    test("fetches CHT balance for wallet on Celo", async () => {
      const apiKey = process.env.ETHERSCAN_API_KEY
      if (!apiKey) {
        throw new Error("ETHERSCAN_API_KEY not set in test environment")
      }

      const result = await fetchTokenBalance(CELO_CHAIN_ID, CHT_TOKEN_ADDRESS, TEST_WALLET_ADDRESS, apiKey)

      console.log("[v2] CHT balance result:", result)

      // CHT has 6 decimals
      const balance = parseTokenBalance(result.result, 6)
      console.log("[v2] CHT parsed balance:", balance)

      expect(balance).toBeGreaterThan(0)
    })

    test("fetches CHT token transfers for wallet on Celo", async () => {
      const apiKey = process.env.ETHERSCAN_API_KEY
      if (!apiKey) {
        throw new Error("ETHERSCAN_API_KEY not set in test environment")
      }

      const result = await fetchTokenTransfers(CELO_CHAIN_ID, CHT_TOKEN_ADDRESS, TEST_WALLET_ADDRESS, apiKey)

      console.log("[v2] CHT transfers count:", result.result?.length)

      expect(result.status).toBe("1")
      expect(result.result).toBeDefined()
      expect(Array.isArray(result.result)).toBe(true)
      expect(result.result.length).toBeGreaterThan(10)

      // Verify first transfer has expected properties
      if (result.result.length > 0) {
        const firstTx = result.result[0]
        expect(firstTx.tokenSymbol).toBe("CHT")
        expect(firstTx.contractAddress.toLowerCase()).toBe(CHT_TOKEN_ADDRESS.toLowerCase())
      }
    })
  })
})
