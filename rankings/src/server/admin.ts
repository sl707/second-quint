import type { SupabaseClient } from "@supabase/supabase-js";
import { checkDisplayName } from "@/domain/profile/display-name";
import type { Contributor, ReportTargetType } from "@/server/catalog";
import type { SignedInPlayer } from "@/server/game";

/** Only the admin may do that, or the thing is gone; the message is safe to show. */
export class AdminError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

/** Whether `player` is the admin (and not banned). */
export async function isAdmin(db: SupabaseClient, player: SignedInPlayer | null): Promise<boolean> {
  if (!player) return false;
  const row = check(
    await db.from("players").select("is_admin, banned").eq("id", player.playerId).maybeSingle(),
  ) as { is_admin: boolean; banned: boolean } | null;
  return !!row && row.is_admin && !row.banned;
}

async function requireAdmin(db: SupabaseClient, player: SignedInPlayer | null): Promise<void> {
  if (!(await isAdmin(db, player))) throw new AdminError("Only the admin can do that.");
}

export type OpenReport = {
  id: number;
  targetType: ReportTargetType;
  /** null once the reported item is gone */
  target: { id: string; name: string; href: string } | null;
  reason: string;
  /** null for signed-out visitors and deleted accounts */
  reporter: Contributor;
  reportedAt: string;
};

type ReportRow = {
  id: number;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  created_at: string;
  players: { id: string; display_name: string } | null;
};

/** How many open reports the admin page lists at once, oldest first. */
export const REPORTS_SHOWN = 200;

/** The open reports, oldest first, with a link to each reported item. Admin only. */
export async function listOpenReports(db: SupabaseClient, player: SignedInPlayer | null): Promise<OpenReport[]> {
  await requireAdmin(db, player);
  const rows = check(
    await db
      .from("reports")
      .select("id, target_type, target_id, reason, created_at, players(id, display_name)")
      .eq("status", "open")
      .order("created_at")
      .order("id")
      .limit(REPORTS_SHOWN),
  ) as unknown as ReportRow[];

  const idsOf = (type: ReportTargetType) => [...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id))];
  const [contestants, categories, players] = await Promise.all([
    namesOf(db, "contestants", "name", idsOf("contestant")),
    namesOf(db, "categories", "name", idsOf("category")),
    namesOf(db, "players", "display_name", idsOf("profile")),
  ]);
  const target = (r: ReportRow): OpenReport["target"] => {
    const name = { contestant: contestants, category: categories, profile: players }[r.target_type].get(r.target_id);
    if (name === undefined) return null;
    const href =
      r.target_type === "contestant"
        ? `/contestants/${r.target_id}`
        : r.target_type === "category"
          ? `/categories/${r.target_id}`
          : `/players/${encodeURIComponent(name)}`;
    return { id: r.target_id, name, href };
  };

  return rows.map((r) => ({
    id: r.id,
    targetType: r.target_type,
    target: target(r),
    reason: r.reason,
    reporter: r.players && { id: r.players.id, displayName: r.players.display_name },
    reportedAt: r.created_at,
  }));
}

async function namesOf(db: SupabaseClient, table: string, column: string, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = check(await db.from(table).select(`id, ${column}`).in("id", ids)) as unknown as Record<string, string>[];
  return new Map(rows.map((r) => [r.id, r[column]]));
}

/**
 * Takes a contestant out of a category. It leaves that category's rankings (and stops being its
 * cover); its matches still count toward overall. Admin only.
 */
export async function removeContestantFromCategory(
  db: SupabaseClient,
  player: SignedInPlayer | null,
  categoryId: string,
  contestantId: string,
): Promise<void> {
  await requireAdmin(db, player);
  const removed =
    UUID.test(categoryId) &&
    UUID.test(contestantId) &&
    (check(await db.rpc("remove_from_category", { p_category_id: categoryId, p_contestant_id: contestantId })) as boolean);
  if (!removed) throw new AdminError("That contestant isn't in this category.");
}

/**
 * Deletes a category with its rankings. Its matches still count toward overall, and its unfinished
 * tournaments end as removed. Admin only.
 */
export async function deleteCategory(db: SupabaseClient, player: SignedInPlayer | null, categoryId: string): Promise<void> {
  await requireAdmin(db, player);
  const deleted = UUID.test(categoryId) && (check(await db.rpc("delete_category", { p_category_id: categoryId })) as boolean);
  if (!deleted) throw new AdminError("That category doesn't exist.");
}

const MERGE_REFUSALS: Record<string, string> = {
  same: "Pick two different contestants.",
  missing: "One of those contestants doesn't exist.",
  already_merged: "One of those contestants was already merged.",
};

export type MergeCandidate = { id: string; name: string; picture128Url: string };

/** The contestant ID in a pasted contestant link or ID, if any. */
function contestantIdIn(input: string): string | null {
  return input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0].toLowerCase() ?? null;
}

/**
 * The two contestants a merge would combine, from pasted contestant links or IDs, for the admin to
 * confirm. Throws an `AdminError` saying what's wrong when the merge couldn't happen. Admin only.
 */
export async function previewMerge(
  db: SupabaseClient,
  player: SignedInPlayer | null,
  duplicateInput: string,
  survivorInput: string,
): Promise<{ duplicate: MergeCandidate; survivor: MergeCandidate }> {
  await requireAdmin(db, player);
  const [duplicateId, survivorId] = [contestantIdIn(duplicateInput), contestantIdIn(survivorInput)];
  if (!duplicateId || !survivorId) throw new AdminError("Paste a contestant link or ID in both boxes.");
  if (duplicateId === survivorId) throw new AdminError(MERGE_REFUSALS.same);
  const rows = check(
    await db.from("contestants").select("id, name, picture_128_url, merged_into").in("id", [duplicateId, survivorId]),
  ) as { id: string; name: string; picture_128_url: string; merged_into: string | null }[];
  const find = (id: string) => rows.find((r) => r.id === id);
  const [duplicate, survivor] = [find(duplicateId), find(survivorId)];
  if (!duplicate || !survivor) throw new AdminError(MERGE_REFUSALS.missing);
  if (duplicate.merged_into || survivor.merged_into) throw new AdminError(MERGE_REFUSALS.already_merged);
  const toCandidate = (r: typeof duplicate) => ({ id: r.id, name: r.name, picture128Url: r.picture_128_url });
  return { duplicate: toCandidate(duplicate), survivor: toCandidate(survivor) };
}

/**
 * Merges a duplicate contestant into the survivor, in one transaction: the duplicate's matches,
 * categories, and covers move to the survivor, matches between the two are dropped, tournaments
 * that drew both end as removed, and the duplicate's page redirects to the survivor's. Rankings
 * take in the moved matches at the next refresh. Admin only.
 */
export async function mergeContestants(
  db: SupabaseClient,
  player: SignedInPlayer | null,
  duplicateId: string,
  survivorId: string,
): Promise<void> {
  await requireAdmin(db, player);
  if (!UUID.test(duplicateId) || !UUID.test(survivorId)) throw new AdminError(MERGE_REFUSALS.missing);
  const outcome = check(await db.rpc("merge_contestants", { p_duplicate_id: duplicateId, p_survivor_id: survivorId })) as string;
  if (outcome !== "merged") throw new AdminError(MERGE_REFUSALS[outcome]);
}

/**
 * Changes a player's display name, under the same rules as choosing one; their profile moves to the
 * new name. Returns the name as stored. Admin only.
 */
export async function renamePlayer(
  db: SupabaseClient,
  player: SignedInPlayer | null,
  playerId: string,
  input: string,
): Promise<string> {
  await requireAdmin(db, player);
  const checked = checkDisplayName(input);
  if (!checked.ok) throw new AdminError(checked.reason);
  const { data, error } = UUID.test(playerId)
    ? await db.from("players").update({ display_name: checked.displayName }).eq("id", playerId).select("id")
    : { data: [], error: null };
  if (error?.code === "23505") throw new AdminError("That display name is taken.");
  if (error) throw error;
  if (!data.length) throw new AdminError("That player doesn't exist.");
  return checked.displayName;
}

/**
 * Bans a player: they can no longer play, add to the catalog, or report. With `removeMatches`, all
 * their matches are excluded from every ranking (flagged, not deleted); without it, any excluded
 * earlier count again. Rankings change at the next refresh. Admin only; the admin can't ban themselves.
 */
export async function banPlayer(
  db: SupabaseClient,
  player: SignedInPlayer | null,
  playerId: string,
  { removeMatches }: { removeMatches: boolean },
): Promise<void> {
  await requireAdmin(db, player);
  if (playerId === player!.playerId) throw new AdminError("You can't ban yourself.");
  await setBan(db, playerId, true, removeMatches);
}

/** Lifts a player's ban; any of their matches the ban removed count again from the next refresh. Admin only. */
export async function unbanPlayer(db: SupabaseClient, player: SignedInPlayer | null, playerId: string): Promise<void> {
  await requireAdmin(db, player);
  await setBan(db, playerId, false, false);
}

export type BanStatus = { banned: boolean; matchesRemoved: boolean };

/** Whether a player is banned and their matches removed from rankings, for the admin; null for anyone else. */
export async function getBanStatus(db: SupabaseClient, player: SignedInPlayer | null, playerId: string): Promise<BanStatus | null> {
  if (!(await isAdmin(db, player)) || !UUID.test(playerId)) return null;
  const [row, excluded] = await Promise.all([
    db.from("players").select("banned").eq("id", playerId).maybeSingle(),
    db.from("matches").select("id", { count: "exact", head: true }).eq("player_id", playerId).eq("excluded", true),
  ]);
  const found = check(row) as { banned: boolean } | null;
  if (excluded.error) throw excluded.error;
  return found && { banned: found.banned, matchesRemoved: (excluded.count ?? 0) > 0 };
}

async function setBan(db: SupabaseClient, playerId: string, banned: boolean, excludeMatches: boolean): Promise<void> {
  const found =
    UUID.test(playerId) &&
    (check(
      await db.rpc("set_player_ban", { p_player_id: playerId, p_banned: banned, p_exclude_matches: excludeMatches }),
    ) as boolean);
  if (!found) throw new AdminError("That player doesn't exist.");
}

/** Closes an open report: resolved (acted on) or dismissed (nothing wrong). Admin only. */
export async function closeReport(
  db: SupabaseClient,
  player: SignedInPlayer | null,
  reportId: number,
  outcome: "resolved" | "dismissed",
): Promise<void> {
  await requireAdmin(db, player);
  const closed = check(
    await db
      .from("reports")
      .update({ status: outcome, closed_at: new Date().toISOString() })
      .eq("id", reportId)
      .eq("status", "open")
      .select("id"),
  ) as unknown[];
  if (!closed.length) throw new AdminError("That report is already closed.");
}
