/**
 * Where to load a community photo from. chb (≥ 3.18) copies photos from public
 * Discord channels to `YYYY/MM/public/images/<attachment id>.<ext>` and points
 * `filePath` there; that copy never expires, unlike the signed Discord `url`.
 * The result goes through the image proxy (getProxiedImageUrl), which resizes.
 * Client-safe: no Node modules.
 */
const PUBLIC_PHOTO = /^\d{4}\/\d{2}\/public\/images\/[^/]+\.(?:jpe?g|png|gif|webp|avif)$/i;

export function photoSource(photo: { url: string; filePath?: string | null }): string {
  const filePath = photo.filePath?.replace(/^\/+/, "").replace(/^data\//, "");
  return filePath && PUBLIC_PHOTO.test(filePath) ? `/data/${filePath}` : photo.url;
}

/** True for a photo's public copy (named after its Discord attachment id, so it never changes). */
export const isPublicPhotoPath = (relativePath: string) => PUBLIC_PHOTO.test(relativePath);
