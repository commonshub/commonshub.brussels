/**
 * Manual test script to test adding a Discord reaction
 *
 * Usage:
 * 1. Update the channelId and messageId below with real values
 * 2. Make sure your dev server is running (npm run dev)
 * 3. Make sure you're logged in to the app
 * 4. Run: npx tsx tests/manual/test-reaction.ts
 */

const TEST_CHANNEL_ID = "1297965144579637248" // Update this with a real channel ID
const TEST_MESSAGE_ID = "1330204028316950568" // Update this with a real message ID
const API_URL = "http://localhost:3000/api/discord/reactions"

async function testReaction() {
  console.log("=== Testing Discord Reaction API ===\n")

  // Test adding a reaction
  console.log("Testing: Adding ⭐ reaction")
  console.log(`Channel: ${TEST_CHANNEL_ID}`)
  console.log(`Message: ${TEST_MESSAGE_ID}\n`)

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // In a real browser, cookies would be sent automatically
        // For this test, you might need to manually add cookies if testing server-side
      },
      body: JSON.stringify({
        channelId: TEST_CHANNEL_ID,
        messageId: TEST_MESSAGE_ID,
        emoji: "⭐",
        add: true,
      }),
    })

    console.log("Response Status:", response.status)
    console.log("Response Status Text:", response.statusText)

    const data = await response.json()
    console.log("Response Body:", JSON.stringify(data, null, 2))

    if (response.ok) {
      console.log("\n✅ Reaction added successfully!")
      console.log("\nNow testing removal...")

      // Test removing the reaction
      const removeResponse = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: TEST_CHANNEL_ID,
          messageId: TEST_MESSAGE_ID,
          emoji: "⭐",
          add: false,
        }),
      })

      const removeData = await removeResponse.json()
      console.log("\nRemove Response Status:", removeResponse.status)
      console.log("Remove Response Body:", JSON.stringify(removeData, null, 2))

      if (removeResponse.ok) {
        console.log("\n✅ Reaction removed successfully!")
      } else {
        console.log("\n❌ Failed to remove reaction")
      }
    } else {
      console.log("\n❌ Failed to add reaction")

      if (response.status === 401) {
        console.log("\n⚠️  401 Unauthorized - Possible causes:")
        console.log("  1. Not logged in")
        console.log("  2. Session expired")
        console.log("  3. Access token not in session (need to re-login)")
        console.log("\nSolution: Log out and log back in to the app")
      } else if (response.status === 500) {
        console.log("\n⚠️  500 Server Error - Check server logs")
        console.log("  Look for [Discord Reactions] logs in your dev server")
      }
    }
  } catch (error) {
    console.error("\n❌ Error:", error)
  }

  console.log("\n=== End ===")
}

testReaction()
