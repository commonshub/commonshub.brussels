/**
 * Manual test script to check Discord authentication and session
 *
 * Usage:
 * 1. Make sure you're logged in to the app
 * 2. Run: npx tsx tests/manual/check-discord-auth.ts
 *
 * This will help debug if the access token is being stored correctly
 */

import { auth } from "@/auth"

async function checkAuth() {
  console.log("=== Checking Discord Authentication ===\n")

  try {
    const session = await auth()

    console.log("Session exists:", !!session)
    console.log("User exists:", !!session?.user)

    if (session?.user) {
      console.log("\nUser data:")
      console.log("  - Discord ID:", session.user.discordId)
      console.log("  - Username:", session.user.username)
      console.log("  - Email:", session.user.email)
      console.log("  - Has Access Token:", !!session.user.accessToken)

      if (session.user.accessToken) {
        console.log("  - Access Token Length:", session.user.accessToken.length)
        console.log("  - Access Token Preview:", session.user.accessToken.substring(0, 20) + "...")
        console.log("\n✅ Access token is available!")
      } else {
        console.log("\n❌ Access token is MISSING from session!")
        console.log("\nAvailable user keys:", Object.keys(session.user))
        console.log("\nThis means you need to:")
        console.log("1. Log out of the application")
        console.log("2. Log back in")
        console.log("3. The fresh login will store the access token")
      }

      console.log("\nUser roles:", session.user.roles)
    } else {
      console.log("\n❌ No user in session!")
      console.log("Make sure you're logged in to the application")
    }

    // Test API endpoint
    if (session?.user?.accessToken) {
      console.log("\n=== Testing Discord API ===")
      console.log("Attempting to fetch user info from Discord API...")

      try {
        const response = await fetch("https://discord.com/api/v10/users/@me", {
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
          },
        })

        console.log("Discord API Response Status:", response.status)

        if (response.ok) {
          const userData = await response.json()
          console.log("✅ Access token is valid!")
          console.log("Discord User:", userData.username + "#" + userData.discriminator)
        } else {
          const errorText = await response.text()
          console.log("❌ Access token is invalid or expired!")
          console.log("Error:", errorText)
          console.log("\nYou need to log out and log back in to get a fresh token")
        }
      } catch (error) {
        console.error("Error testing Discord API:", error)
      }
    }

  } catch (error) {
    console.error("Error checking auth:", error)
  }

  console.log("\n=== End ===")
}

checkAuth()
