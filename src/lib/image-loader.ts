import { clampImageSizeToMax, getImageSizeForWidth } from "./image-size";

function shouldBypassOptimization(src: string): boolean {
  return (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("/images/partners/") ||
    /\.svg(?:\?|$)/i.test(src)
  );
}

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  // Proxy endpoints can't be passed through /_next/image, so map widths to
  // our explicit proxy size buckets instead.
  if (src.startsWith("/api/image-proxy")) {
    try {
      const url = new URL(src, "http://localhost");
      const explicitSize = url.searchParams.get("size");
      const requestedSize = getImageSizeForWidth(width);
      if (explicitSize === "xs" || explicitSize === "sm" || explicitSize === "md" || explicitSize === "lg") {
        url.searchParams.set(
          "size",
          clampImageSizeToMax(requestedSize, explicitSize)
        );
      } else {
        url.searchParams.set("size", requestedSize);
      }
      if (quality !== undefined) {
        url.searchParams.set("q", quality.toString());
      }
      return `${url.pathname}${url.search}`;
    } catch (error) {
      console.error("Error parsing image proxy URL:", error);
      return src;
    }
  }

  if (shouldBypassOptimization(src)) {
    return src;
  }

  if (src.startsWith("/images/")) {
    const url = new URL("/api/image-proxy", "http://localhost");
    url.searchParams.set("url", src);
    url.searchParams.set(
      "size",
      getImageSizeForWidth(Math.min(width, 1024))
    );
    if (quality !== undefined) {
      url.searchParams.set("q", quality.toString());
    }
    return `${url.pathname}${url.search}`;
  }

  return src;
}
