// Script to parse partner data from Commons Hub Brussels HTML
// Run this to extract logo URLs and websites from the HTML blob

const html = `<div class="framer-gbffvu"><!--$--><div class="framer-1kmrsdm"><!--$--><!--/$--><div class="ssr-variant hidden-slybcz hidden-15selhf"><a as="a" class="framer-1vywuo5 framer-e72xm3" href="https://apusetlescocottesvolantes.com/" target="_blank" rel="noopener"><div data-framer-background-image-wrapper="true" style="position: absolute; border-radius: inherit; inset: 0px;"><img decoding="auto" width="900" height="600" sizes="120px" srcset="https://framerusercontent.com/images/9gLGfZiRXw7FpHLmQSz4WSOGboQ.png?scale-down-to=512&amp;width=900&amp;height=600 512w,https://framerusercontent.com/images/9gLGfZiRXw7FpHLmQSz4WSOGboQ.png?width=900&amp;height=600 900w" src="https://framerusercontent.com/images/9gLGfZiRXw7FpHLmQSz4WSOGboQ.png?width=900&amp;height=600" alt="" style="display: block; width: 100%; height: 100%; border-radius: inherit; object-position: center center; object-fit: contain;"></div></a></div></div><div class="framer-1kmrsdm"><!--$--><!--/$--><div class="ssr-variant hidden-slybcz hidden-15selhf"><a as="a" class="framer-1vywuo5 framer-e72xm3" href="https://www.be-impact.org" target="_blank" rel="noopener"><div data-framer-background-image-wrapper="true" style="position: absolute; border-radius: inherit; inset: 0px;"><img decoding="auto" width="900" height="600" sizes="120px" srcset="https://framerusercontent.com/images/g4XansGDeSt5VxN6V8e3h4grx6I.png?scale-down-to=512&amp;width=900&amp;height=600 512w,https://framerusercontent.com/images/g4XansGDeSt5VxN6V8e3h4grx6I.png?width=900&amp;height=600 900w" src="https://framerusercontent.com/images/g4XansGDeSt5VxN6V8e3h4grx6I.png?width=900&amp;height=600" alt="" style="display: block; width: 100%; height: 100%; border-radius: inherit; object-position: center center; object-fit: contain;"></div></a></div></div><div class="framer-1kmrsdm" style="opacity: 1; will-change: transform; transform: none;"><!--$--><!--/$--><div class="ssr-variant hidden-slybcz hidden-15selhf"><a as="a" class="framer-1vywuo5 framer-e... <truncated>`

// Parse partners from HTML
const partners = []

// Match all anchor tags with their images
const anchorRegex = /<a[^>]*href="([^"]+)"[^>]*>.*?<img[^>]*src="([^"?]+)[^"]*"[^>]*>/gs
let match

while ((match = anchorRegex.exec(html)) !== null) {
  const website = match[1]
  const logo = match[2]

  // Extract name from website URL
  let name = website
    .replace(/https?:\/\/(www\.)?/, "")
    .replace(/\.(com|org|be|earth|studio|community|brussels).*/, "")
    .replace(/-/g, " ")
    .split("/")
    .filter(Boolean)[0]

  // Capitalize
  name = name.charAt(0).toUpperCase() + name.slice(1)

  // Special case mappings
  const nameMap = {
    apusetlescocottesvolantes: "Apus et les Cocottes Volantes",
    "be impact": "BeImpact",
    bedonut: "BeDonut",
    bfrpd: "BFRPD",
    "bees coop": "BeesCoop",
    commonslab: "Commons Lab",
    dao: "DAO.brussels",
    "fondation mycelium": "Fondation Mycelium",
    inflights: "Inflights",
    innerpreneurs: "Innerpreneurs",
    northstaragi: "North Star AGI",
    opencollective: "Open Collective",
    rcr2: "RCR2",
    rebel: "Rebel",
    regensunite: "Regens Unite",
    "purpose economy": "Steward Owned",
  }

  const normalizedName = name.toLowerCase()
  if (nameMap[normalizedName]) {
    name = nameMap[normalizedName]
  }

  partners.push({
    name,
    logo,
    website,
    description: "",
  })
}

console.log(JSON.stringify(partners, null, 2))
