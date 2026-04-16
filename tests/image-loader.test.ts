/**
 * @jest-environment node
 */

import { describe, expect, test } from "@jest/globals";
import imageLoader from "@/lib/image-loader";

describe("imageLoader", () => {
  test("maps proxy image widths to proxy size buckets", () => {
    expect(
      imageLoader({
        src: "/api/image-proxy?url=https%3A%2F%2Fimages.lumacdn.com%2Fcover.jpg",
        width: 300,
      })
    ).toContain("size=xs");

    expect(
      imageLoader({
        src: "/api/image-proxy?url=https%3A%2F%2Fimages.lumacdn.com%2Fcover.jpg",
        width: 500,
      })
    ).toContain("size=sm");

    expect(
      imageLoader({
        src: "/api/image-proxy?url=https%3A%2F%2Fimages.lumacdn.com%2Fcover.jpg",
        width: 900,
      })
    ).toContain("size=md");

    expect(
      imageLoader({
        src: "/api/image-proxy?url=https%3A%2F%2Fimages.lumacdn.com%2Fcover.jpg",
        width: 1400,
      })
    ).toContain("size=lg");
  });

  test("routes /images assets through Next optimization capped at md", () => {
    const url = imageLoader({
      src: "/images/chb-facade.avif",
      width: 1200,
    });

    expect(url).toBe("/api/image-proxy?url=%2Fimages%2Fchb-facade.avif&size=md");
  });

  test("does not resize partner logos from /images/partners", () => {
    const url = imageLoader({
      src: "/images/partners/beimpact.png",
      width: 80,
    });

    expect(url).toBe("/images/partners/beimpact.png");
  });

  test("leaves non-proxy remote images untouched", () => {
    const url = imageLoader({
      src: "https://images.lumacdn.com/event-covers/abc.jpg",
      width: 640,
      quality: 85,
    });

    expect(url).toBe("https://images.lumacdn.com/event-covers/abc.jpg");
  });

  test("leaves svg assets unoptimized", () => {
    const url = imageLoader({
      src: "/placeholder.svg",
      width: 320,
    });

    expect(url).toBe("/placeholder.svg");
  });
});
