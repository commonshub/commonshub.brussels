export const SIZE_CONFIG = {
  xs: 320,
  sm: 640,
  md: 1024,
  lg: 1920,
} as const;

export type ImageSize = keyof typeof SIZE_CONFIG;

const SIZE_ORDER: ImageSize[] = ["xs", "sm", "md", "lg"];

export function getImageSizeForWidth(width: number): ImageSize {
  if (width <= SIZE_CONFIG.xs) return "xs";
  if (width <= SIZE_CONFIG.sm) return "sm";
  if (width <= SIZE_CONFIG.md) return "md";
  return "lg";
}

export function getSmallerImageSize(
  left: ImageSize,
  right: ImageSize
): ImageSize {
  return SIZE_ORDER.indexOf(left) <= SIZE_ORDER.indexOf(right) ? left : right;
}

export function clampImageSizeToMax(
  requested: ImageSize,
  maxAllowed: ImageSize
): ImageSize {
  return getSmallerImageSize(requested, maxAllowed);
}

export function resolveRequestedImageSize(
  sizeParam: string | null,
  widthParam: string | null
): ImageSize | null {
  if (sizeParam && sizeParam in SIZE_CONFIG) {
    return sizeParam as ImageSize;
  }

  if (!widthParam) {
    return null;
  }

  const width = Number.parseInt(widthParam, 10);
  if (Number.isNaN(width) || width <= 0) {
    return null;
  }

  return getImageSizeForWidth(width);
}
