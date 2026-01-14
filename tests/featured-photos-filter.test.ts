/**
 * Test for featured photos filtering logic
 * Verifies that photos with star reactions are correctly identified
 */

// Star emoji variants to check for (both Unicode and Discord names)
const STAR_EMOJIS = ["⭐", "🌟", "✨", "star", "star2", "sparkles"];

function hasStarReaction(reactions: Array<{ emoji: string; count: number }>): boolean {
  if (!reactions || reactions.length === 0) return false;
  return reactions.some(reaction =>
    STAR_EMOJIS.includes(reaction.emoji) && reaction.count > 0
  );
}

// Mock photo data with various reaction scenarios
const testPhotos = [
  {
    messageId: "1443593140463472855",
    url: "https://example.com/photo1.jpg",
    reactions: [
      { emoji: "⭐", count: 1 }
    ]
  },
  {
    messageId: "2",
    url: "https://example.com/photo2.jpg",
    reactions: [
      { emoji: "👍", count: 5 }
    ]
  },
  {
    messageId: "3",
    url: "https://example.com/photo3.jpg",
    reactions: [
      { emoji: "🌟", count: 2 }
    ]
  },
  {
    messageId: "4",
    url: "https://example.com/photo4.jpg",
    reactions: []
  },
  {
    messageId: "5",
    url: "https://example.com/photo5.jpg",
    reactions: [
      { emoji: "✨", count: 1 },
      { emoji: "👍", count: 3 }
    ]
  },
  {
    messageId: "6",
    url: "https://example.com/photo6.jpg",
    reactions: [
      { emoji: "⭐", count: 0 } // Zero count should not match
    ]
  },
  {
    messageId: "7",
    url: "https://example.com/photo7.jpg",
    reactions: [
      { emoji: "❤️", count: 10 }
    ]
  },
  {
    messageId: "8",
    url: "https://example.com/photo8.jpg",
    reactions: [
      { emoji: "star", count: 2 } // Discord emoji name format
    ]
  },
  {
    messageId: "9",
    url: "https://example.com/photo9.jpg",
    reactions: [
      { emoji: "star2", count: 1 } // Discord emoji name format
    ]
  },
  {
    messageId: "10",
    url: "https://example.com/photo10.jpg",
    reactions: [
      { emoji: "sparkles", count: 3 } // Discord emoji name format
    ]
  }
];

console.log("🧪 Testing Featured Photos Filter Logic\n");
console.log("=".repeat(60));

// Test each photo
console.log("\n📸 Testing individual photos:\n");
testPhotos.forEach(photo => {
  const isFeatured = hasStarReaction(photo.reactions);
  const status = isFeatured ? "✅ FEATURED" : "❌ NOT FEATURED";
  console.log(`${status} - Message ${photo.messageId}`);
  console.log(`  Reactions: ${JSON.stringify(photo.reactions)}`);
});

// Filter featured photos
const featuredPhotos = testPhotos.filter(photo => hasStarReaction(photo.reactions));

console.log("\n" + "=".repeat(60));
console.log(`\n📊 Results: ${featuredPhotos.length} of ${testPhotos.length} photos are featured\n`);

// Expected featured photos (includes both Unicode and Discord name formats)
const expectedFeaturedIds = ["1443593140463472855", "3", "5", "8", "9", "10"];
const actualFeaturedIds = featuredPhotos.map(p => p.messageId);

console.log("Expected featured message IDs:", expectedFeaturedIds);
console.log("Actual featured message IDs:", actualFeaturedIds);

// Verify results
const allMatch = expectedFeaturedIds.every(id => actualFeaturedIds.includes(id)) &&
                 actualFeaturedIds.every(id => expectedFeaturedIds.includes(id));

console.log("\n" + "=".repeat(60));
if (allMatch && featuredPhotos.length === expectedFeaturedIds.length) {
  console.log("\n✅ ALL TESTS PASSED - Filtering logic is correct!\n");
  console.log("The featured photos filter correctly identifies photos with:");
  console.log("  - ⭐ (star) / 'star' reactions");
  console.log("  - 🌟 (glowing star) / 'star2' reactions");
  console.log("  - ✨ (sparkles) / 'sparkles' reactions");
  console.log("  - Both Unicode and Discord name formats");
  console.log("  - count > 0");
  process.exit(0);
} else {
  console.log("\n❌ TESTS FAILED - Filtering logic has issues!\n");
  console.log("Expected:", expectedFeaturedIds);
  console.log("Got:", actualFeaturedIds);
  process.exit(1);
}
