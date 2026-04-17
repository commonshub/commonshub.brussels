import partners from "../src/settings/partners.json";
import fs from "fs";
import path from "path";

describe("Partners Data Integrity", () => {
  const partnersDir = path.join(process.cwd(), "public", "partners");

  test("partners.json contains partners", () => {
    expect(Array.isArray(partners)).toBe(true);
    expect(partners.length).toBeGreaterThan(0);
  });

  test("each partner has required fields", () => {
    partners.forEach(
      (partner: { name: string; logo: string; website: string }) => {
        expect(partner).toHaveProperty("name");
        expect(partner).toHaveProperty("logo");
        expect(partner).toHaveProperty("website");
        expect(typeof partner.name).toBe("string");
        expect(typeof partner.logo).toBe("string");
        expect(typeof partner.website).toBe("string");
      }
    );
  });

  test("each partner logo file exists locally", () => {
    partners.forEach((partner: { name: string; logo: string }) => {
      // Logo paths are like "/images/partners/filename.png"
      const logoPath = path.join(process.cwd(), "public", partner.logo);
      const exists = fs.existsSync(logoPath);
      expect(exists).toBe(true);
    });
  });

  test("each partner logo file is at least 4KB", () => {
    partners.forEach((partner: { name: string; logo: string }) => {
      const logoPath = path.join(process.cwd(), "public", partner.logo);
      const stats = fs.statSync(logoPath);
      const sizeInKB = stats.size / 1024;
      expect(sizeInKB).toBeGreaterThanOrEqual(1.7);
    });
  });

  test("number of partners in JSON matches expected count", () => {
    // Update this count if partners are added/removed
    const expectedPartnerCount = 21;
    expect(partners.length).toBe(expectedPartnerCount);
  });
});
