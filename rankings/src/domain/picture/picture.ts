/**
 * Picture rules shared by the browser upload and any server-side import: which files are
 * accepted, and how each is cut down to the stored squares (center-cropped for uploads).
 */

export const ACCEPTED_PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_PICTURE_BYTES = 5 * 1024 * 1024;
/** A picture copied from a link travels back to the browser in a function response, which Vercel caps at 4.5 MB. */
export const MAX_LINKED_PICTURE_BYTES = 4 * 1024 * 1024;

/** Stored sizes in px: 512 for matches, 128 for lists. */
export const PICTURE_SIZES = [512, 128] as const;
export type PictureSize = (typeof PICTURE_SIZES)[number];

/** Stored pictures are WebP; JPEG is the fallback for browsers that can't encode WebP. */
export type StoredPictureType = "image/webp" | "image/jpeg";
export const STORED_PICTURE_QUALITY = 0.85;
/** Largest resized picture the server accepts, per size. */
export const MAX_STORED_PICTURE_BYTES = 700 * 1024;

export type PictureCheck = { ok: true } | { ok: false; reason: string };

/** Whether a picture the player chose can be used, before any resizing. */
export function checkPictureFile(file: { type: string; size: number }): PictureCheck {
  if (!(ACCEPTED_PICTURE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "Pictures must be JPG, PNG, WebP, or GIF." };
  }
  if (file.size > MAX_PICTURE_BYTES) return { ok: false, reason: "Pictures can be up to 5 MB." };
  return { ok: true };
}

/** The largest centered square inside a `width` × `height` picture, in source pixels. */
export function centerSquareCrop(width: number, height: number): { left: number; top: number; size: number } {
  const size = Math.min(width, height);
  return { left: Math.floor((width - size) / 2), top: Math.floor((height - size) / 2), size };
}

/**
 * The largest square inside a `width` × `height` picture, centered across but kept at the top,
 * where a character's face usually is in portrait art. Used by bulk imports of character art.
 */
export function topSquareCrop(width: number, height: number): { left: number; top: number; size: number } {
  const size = Math.min(width, height);
  return { left: Math.floor((width - size) / 2), top: 0, size };
}

export type AcceptedPictureType = (typeof ACCEPTED_PICTURE_TYPES)[number];

/** The type of an accepted picture, read from its bytes rather than any claimed type; null if it isn't one. */
export function sniffPictureType(bytes: Uint8Array): AcceptedPictureType | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 8) === "PNG\r\n\x1a\n") return "image/png";
  if (bytes.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  return null;
}

/** The type of a resized picture, read from its bytes; null if it isn't a WebP or JPEG. */
export function storedPictureType(bytes: Uint8Array): StoredPictureType | null {
  const type = sniffPictureType(bytes);
  return type === "image/webp" || type === "image/jpeg" ? type : null;
}
