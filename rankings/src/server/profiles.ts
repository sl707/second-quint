import type { SupabaseClient } from "@supabase/supabase-js";
import { checkDisplayName } from "@/domain/profile/display-name";
import type { SignedInPlayer } from "@/server/game";

/** A player as anyone may see them: never their real name or email. */
export type Player = { id: string; displayName: string; createdAt: string };

/** A profile rule was broken; the message is safe to show to the person signing in. */
export class ProfileError extends Error {}

const PUBLIC_COLUMNS = "id, displayName:display_name, createdAt:created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

/** The player a signed-in auth user is, or null if they haven't chosen a display name yet. */
export async function findPlayerByUser(db: SupabaseClient, userId: string): Promise<Player | null> {
  return check(await db.from("players").select(PUBLIC_COLUMNS).eq("user_id", userId).maybeSingle()) as Player | null;
}

/** Whether a signed-in auth user is the same sign-in as a banned player who deleted their account. */
export async function isBannedIdentity(db: SupabaseClient, userId: string): Promise<boolean> {
  return check(await db.rpc("is_banned_identity", { p_user_id: userId })) as boolean;
}

export const BANNED_IDENTITY_MESSAGE = "This account is banned.";

/** Makes a signed-in auth user a player under `input`, at first sign-in. */
export async function chooseDisplayName(db: SupabaseClient, userId: string, input: string): Promise<Player> {
  const checked = checkDisplayName(input);
  if (!checked.ok) throw new ProfileError(checked.reason);
  if (await findPlayerByUser(db, userId)) throw new ProfileError("You already chose a display name.");
  if (await isBannedIdentity(db, userId)) throw new ProfileError(BANNED_IDENTITY_MESSAGE);

  const { data, error } = await db
    .from("players")
    .insert({ user_id: userId, display_name: checked.displayName })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error?.code === "23505") {
    if (error.message.includes("user_id")) throw new ProfileError("You already chose a display name.");
    throw new ProfileError("That display name is taken.");
  }
  if (error) throw error;
  return data as unknown as Player;
}

/**
 * Deletes the player's account: their profile, display name, tournaments, and personal rankings go,
 * and so does their auth user (with their email). Their matches keep counting in global rankings and
 * their contestants and categories stay, all credited to an anonymous deleted player.
 */
export async function deleteAccount(db: SupabaseClient, player: SignedInPlayer): Promise<void> {
  const userId = check(await db.rpc("delete_player_account", { p_player_id: player.playerId })) as string | null;
  if (!userId) throw new ProfileError("That account doesn't exist.");
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** How many players a search lists at once, by display name. */
export const SEARCH_RESULTS_SHOWN = 20;

/**
 * Players whose display name starts with `query`, ignoring case, in display-name order. Banned
 * players and deleted accounts never show up.
 */
export async function searchPlayers(db: SupabaseClient, query: string): Promise<Player[]> {
  const prefix = query.trim().toLowerCase();
  // Only these characters can be in a display name; `_` is a LIKE wildcard, so it's escaped.
  if (!/^[a-z0-9_-]+$/.test(prefix)) return [];
  return check(
    await db
      .from("players")
      .select(PUBLIC_COLUMNS)
      .not("display_name", "is", null)
      .eq("banned", false)
      .ilike("display_name", `${prefix.replaceAll("_", "\\_")}%`)
      .order("display_name")
      .limit(SEARCH_RESULTS_SHOWN),
  ) as Player[];
}

/** The player whose profile is at `idOrDisplayName` (a player ID, or a display name in any case). */
export async function getProfile(db: SupabaseClient, idOrDisplayName: string): Promise<Player | null> {
  // The deleted-player tombstone has no display name and no profile.
  const query = db.from("players").select(PUBLIC_COLUMNS).not("display_name", "is", null);
  const filtered = UUID.test(idOrDisplayName)
    ? query.eq("id", idOrDisplayName)
    : query.eq("display_name_key", idOrDisplayName.toLowerCase());
  return check(await filtered.maybeSingle()) as Player | null;
}
