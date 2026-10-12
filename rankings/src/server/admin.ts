import type { SupabaseClient } from "@supabase/supabase-js";
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
