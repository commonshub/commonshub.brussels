import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// Star emoji variants to check for (both Unicode and Discord names)
const STAR_EMOJIS = ["⭐", "🌟", "✨", "star", "star2", "sparkles"];

interface DiscordImage {
  url: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  };
  reactions: Array<{ emoji: string; count: number }>;
  totalReactions: number;
  message: string;
  timestamp: string;
  channelId: string;
  messageId: string;
}

interface ImagesData {
  year: string;
  month?: string;
  images: DiscordImage[];
}

function hasStarReaction(reactions: Array<{ emoji: string; count: number }>): boolean {
  if (!reactions || reactions.length === 0) return false;
  return reactions.some(reaction =>
    STAR_EMOJIS.includes(reaction.emoji) && reaction.count > 0
  );
}

function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        } else {
          fs.unlink(filepath, () => {});
          reject(new Error(`Failed to download: ${response.statusCode}`));
        }
      })
      .on("error", (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
  });
}

function getImageFilename(url: string, messageId: string): string {
  const urlParts = url.split("/");
  const filename = urlParts[urlParts.length - 1].split("?")[0];
  const ext = path.extname(filename) || ".jpg";
  return `${messageId}${ext}`;
}

async function downloadFeaturedImages(year: string) {
  console.log(`\n📸 Downloading Featured Images for ${year}\n`);
  console.log("=".repeat(60));

  // Read images data from all months in the year
  const yearPath = path.join(process.cwd(), "data", year);

  if (!fs.existsSync(yearPath)) {
    console.error(`\n❌ Error: No data found for ${year}`);
    console.error(`   Expected: ${yearPath}`);
    process.exit(1);
  }

  const allFeaturedImages: DiscordImage[] = [];

  // Iterate through all month directories
  const months = fs.readdirSync(yearPath)
    .filter(f => /^\d{2}$/.test(f))
    .sort();

  if (months.length === 0) {
    console.error(`\n❌ Error: No monthly data found in ${yearPath}`);
    process.exit(1);
  }

  console.log(`\n📁 Scanning ${months.length} months for featured images...\n`);

  for (const month of months) {
    const imagesPath = path.join(yearPath, month, "discord", "images.json");

    if (!fs.existsSync(imagesPath)) {
      console.log(`⊘ Skipping ${year}-${month}: No Discord images data`);
      continue;
    }

    try {
      const data: ImagesData = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));
      const monthFeatured = data.images.filter((image) =>
        hasStarReaction(image.reactions)
      );

      if (monthFeatured.length > 0) {
        console.log(`✨ ${year}-${month}: Found ${monthFeatured.length} featured images`);
        allFeaturedImages.push(...monthFeatured);
      }
    } catch (error) {
      console.error(`❌ Error reading ${year}-${month}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const featuredImages = allFeaturedImages;

  if (featuredImages.length === 0) {
    console.log(`\n⚠️  No featured images found for ${year}`);
    console.log("   Images need star emoji reactions (⭐ 🌟 ✨) to be featured\n");
    return;
  }

  console.log(`\n✨ Found ${featuredImages.length} featured images\n`);

  // Create the featured images directory
  const featuredDir = path.join(process.cwd(), "data", year, "featured", "images");
  fs.mkdirSync(featuredDir, { recursive: true });

  // Download each featured image
  let successCount = 0;
  let errorCount = 0;

  for (const [index, image] of featuredImages.entries()) {
    const filename = getImageFilename(image.url, image.messageId);
    const filepath = path.join(featuredDir, filename);

    // Skip if already exists
    if (fs.existsSync(filepath)) {
      console.log(`⊘ [${index + 1}/${featuredImages.length}] Already exists: ${filename}`);
      successCount++;
      continue;
    }

    try {
      console.log(`⬇️  [${index + 1}/${featuredImages.length}] Downloading: ${filename}`);
      await downloadImage(image.url, filepath);
      successCount++;

      // Create metadata file
      const metadataPath = filepath.replace(path.extname(filepath), ".json");
      const metadata = {
        messageId: image.messageId,
        channelId: image.channelId,
        timestamp: image.timestamp,
        author: image.author,
        message: image.message,
        reactions: image.reactions,
        url: image.url,
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error(`❌ [${index + 1}/${featuredImages.length}] Failed: ${filename}`);
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n✅ Downloaded ${successCount} featured images`);
  if (errorCount > 0) {
    console.log(`❌ Failed to download ${errorCount} images`);
  }
  console.log(`📁 Saved to: ${featuredDir}\n`);
}

// Main execution
const year = process.argv[2];

if (!year) {
  console.error("\n❌ Error: Year argument is required\n");
  console.error("Usage: npm run download-featured-images <year>");
  console.error("Example: npm run download-featured-images 2025\n");
  process.exit(1);
}

if (!/^\d{4}$/.test(year)) {
  console.error(`\n❌ Error: Invalid year format: ${year}`);
  console.error("Year must be a 4-digit number (e.g., 2025)\n");
  process.exit(1);
}

downloadFeaturedImages(year).catch((error) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});
