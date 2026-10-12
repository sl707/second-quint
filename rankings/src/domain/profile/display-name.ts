export const MIN_DISPLAY_NAME_LENGTH = 3;
export const MAX_DISPLAY_NAME_LENGTH = 24;

export type DisplayNameCheck = { ok: true; displayName: string } | { ok: false; reason: string };

/**
 * Whether `input` can be a display name, and its trimmed form. Uniqueness is case-insensitive and
 * checked by the database.
 */
export function checkDisplayName(input: string): DisplayNameCheck {
  const displayName = input.trim();
  if (displayName.length < MIN_DISPLAY_NAME_LENGTH || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, reason: `Display names are ${MIN_DISPLAY_NAME_LENGTH} to ${MAX_DISPLAY_NAME_LENGTH} characters.` };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(displayName)) {
    return { ok: false, reason: "Use only letters, digits, underscores, and hyphens." };
  }
  return { ok: true, displayName };
}
