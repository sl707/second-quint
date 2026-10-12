export const MIN_DISPLAY_NAME_LENGTH = 3;
export const MAX_DISPLAY_NAME_LENGTH = 24;

export type DisplayNameCheck = { ok: true; displayName: string } | { ok: false; reason: string };

const WORDS = /^[\p{L}\p{Nd}_-]+(?: [\p{L}\p{Nd}_-]+)*$/u;

/**
 * Whether `input` can be a display name, and its normalized form: accents composed (NFC), trimmed,
 * and runs of whitespace inside collapsed to one space. Length counts characters (code points).
 * Uniqueness is case-insensitive and checked by the database.
 */
export function checkDisplayName(input: string): DisplayNameCheck {
  const displayName = input.normalize("NFC").trim().replace(/\s+/g, " ");
  const length = [...displayName].length;
  if (length < MIN_DISPLAY_NAME_LENGTH || length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, reason: `Display names are ${MIN_DISPLAY_NAME_LENGTH} to ${MAX_DISPLAY_NAME_LENGTH} characters.` };
  }
  if (!WORDS.test(displayName)) {
    return { ok: false, reason: "Use only letters, digits, spaces, underscores, and hyphens." };
  }
  return { ok: true, displayName };
}
