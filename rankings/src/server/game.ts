import type { SupabaseClient } from "@supabase/supabase-js";
import { drawBracket, playBracket, type BracketState, type Random, type Slot } from "@/domain/tournament/bracket";
import { tournamentSizeOptions, type TournamentSizeOptions } from "@/domain/tournament/size";

/** A signed-out visitor, known by the anonymous visitor ID kept in their browser. */
export type Visitor = { visitorId: string };

/** A signed-in player, known by their player ID. */
export type SignedInPlayer = { playerId: string };

/** Whoever is playing: their tournaments and matches are stored against them. */
export type Person = Visitor | SignedInPlayer;

/** The row filter that matches what `person` owns. */
function ownedBy(person: Person): Record<string, string> {
  return "playerId" in person ? { player_id: person.playerId } : { visitor_id: person.visitorId };
}

/** The owner columns to store on a new tournament or match. */
function ownerColumns(person: Person) {
  return "playerId" in person
    ? { player_id: person.playerId, visitor_id: null }
    : { player_id: null, visitor_id: person.visitorId };
}

/** A category ID, or null for all contestants. */
export type ScopeId = string | null;

export type ScopeOption = {
  categoryId: ScopeId;
  name: string;
  contestantCount: number;
  /** null when the scope is too small for a tournament */
  sizes: TournamentSizeOptions | null;
};

export type ContestantCard = { id: string; name: string; picture512Url: string; picture128Url: string };

export type TournamentStatus = "in_progress" | "finished" | "given_up";

export type Tournament = {
  id: string;
  categoryId: ScopeId;
  scopeName: string;
  size: number;
  rated: boolean;
  status: TournamentStatus;
  bracket: BracketState;
  contestants: Record<string, ContestantCard>;
  canUndo: boolean;
  createdAt: string;
};

export type UnfinishedTournament = {
  id: string;
  scopeName: string;
  size: number;
  matchesLeft: number;
  createdAt: string;
};

/** A play rule was broken; the message is safe to show to the person playing. */
export class GameError extends Error {}

const ALL_CONTESTANTS = "All contestants";
const PAGE = 1000;

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

async function scopeContestantIds(db: SupabaseClient, categoryId: ScopeId): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows =
      categoryId === null
        ? check(await db.from("contestants").select("id").is("merged_into", null).order("id").range(from, from + PAGE - 1))
        : check(
            await db
              .from("category_memberships")
              .select("id:contestant_id")
              .eq("category_id", categoryId)
              .order("contestant_id")
              .range(from, from + PAGE - 1),
          );
    ids.push(...rows.map((r: { id: string }) => r.id));
    if (rows.length < PAGE) return ids;
  }
}

async function scopeName(db: SupabaseClient, categoryId: ScopeId): Promise<string> {
  if (categoryId === null) return ALL_CONTESTANTS;
  const category = check<{ name: string } | null>(await db.from("categories").select("name").eq("id", categoryId).maybeSingle());
  if (!category) throw new GameError("That category doesn't exist.");
  return category.name;
}

/** Every scope a tournament can be started from, with its size options. */
export async function listTournamentScopes(db: SupabaseClient): Promise<ScopeOption[]> {
  const { count } = await db.from("contestants").select("id", { count: "exact", head: true }).is("merged_into", null);
  const categories = check(
    await db.from("categories").select("id, name, category_memberships(count)").order("name"),
  ) as { id: string; name: string; category_memberships: { count: number }[] }[];

  const option = (categoryId: ScopeId, name: string, contestantCount: number): ScopeOption => ({
    categoryId,
    name,
    contestantCount,
    sizes: tournamentSizeOptions(contestantCount),
  });
  return [
    option(null, ALL_CONTESTANTS, count ?? 0),
    ...categories.map((c) => option(c.id, c.name, c.category_memberships[0]?.count ?? 0)),
  ];
}

export async function startTournament(
  db: SupabaseClient,
  person: Person,
  options: { categoryId: ScopeId; size?: number },
  random: Random = Math.random,
): Promise<{ tournamentId: string }> {
  await scopeName(db, options.categoryId);
  const scope = await scopeContestantIds(db, options.categoryId);
  const sizes = tournamentSizeOptions(scope.length);
  if (!sizes) throw new GameError("A tournament needs a scope of at least 4 contestants.");
  const size = options.size ?? sizes.default;
  if (!Number.isInteger(size) || size < sizes.min || size > sizes.max) {
    throw new GameError(`Tournament size must be from ${sizes.min} to ${sizes.max}.`);
  }

  const tournament = check<{ id: string }>(
    await db
      .from("tournaments")
      .insert({
        ...ownerColumns(person),
        category_id: options.categoryId,
        size,
        bracket: { slots: drawBracket(scope, size, random) },
      })
      .select("id")
      .single(),
  );
  return { tournamentId: tournament.id };
}

type TournamentRow = {
  id: string;
  category_id: ScopeId;
  size: number;
  rated: boolean;
  status: TournamentStatus;
  bracket: { slots: Slot[] };
  can_undo: boolean;
  created_at: string;
};

async function loadOwnTournament(db: SupabaseClient, person: Person, tournamentId: string) {
  const row = check(
    await db
      .from("tournaments")
      .select("id, category_id, size, rated, status, bracket, can_undo, created_at")
      .eq("id", tournamentId)
      .match(ownedBy(person))
      .maybeSingle(),
  ) as TournamentRow | null;
  if (!row) return null;
  const picks = check(
    await db
      .from("matches")
      .select("winnerId:winner_id, loserId:loser_id")
      .eq("tournament_id", tournamentId)
      .order("bracket_match"),
  ) as { winnerId: string; loserId: string }[];
  return { row, bracket: playBracket(row.bracket.slots, picks) };
}

/** The person's tournament with its bracket replayed, or null if it isn't theirs. */
export async function getTournament(db: SupabaseClient, person: Person, tournamentId: string): Promise<Tournament | null> {
  const loaded = await loadOwnTournament(db, person, tournamentId);
  if (!loaded) return null;
  const { row, bracket } = loaded;

  const ids = row.bracket.slots.filter((s): s is string => s !== null);
  const cards = check(
    await db.from("contestants").select("id, name, picture_512_url, picture_128_url").in("id", ids),
  ) as { id: string; name: string; picture_512_url: string; picture_128_url: string }[];

  return {
    id: row.id,
    categoryId: row.category_id,
    scopeName: await scopeName(db, row.category_id).catch(() => "A deleted category"),
    size: row.size,
    rated: row.rated,
    status: row.status,
    bracket,
    contestants: Object.fromEntries(
      cards.map((c) => [c.id, { id: c.id, name: c.name, picture512Url: c.picture_512_url, picture128Url: c.picture_128_url }]),
    ),
    canUndo: row.can_undo && bracket.matchesPlayed > 0,
    createdAt: row.created_at,
  };
}

async function requireOwnTournament(db: SupabaseClient, person: Person, tournamentId: string) {
  const loaded = await loadOwnTournament(db, person, tournamentId);
  if (!loaded) throw new GameError("That tournament doesn't exist.");
  return loaded;
}

/**
 * Records the person's pick for the tournament's next match. Passing the `matchIndex` they
 * were shown guards against a repeated tap landing on the following match.
 */
export async function pickWinner(
  db: SupabaseClient,
  person: Person,
  tournamentId: string,
  winnerId: string,
  options: { matchIndex?: number } = {},
): Promise<void> {
  const { row, bracket } = await requireOwnTournament(db, person, tournamentId);
  const next = bracket.next;
  if (row.status !== "in_progress" || !next) throw new GameError("This tournament has no match left to pick.");
  if (options.matchIndex !== undefined && options.matchIndex !== next.index) {
    throw new GameError("That match was already picked.");
  }
  if (!next.contestantIds.includes(winnerId)) throw new GameError("That contestant isn't in the current match.");

  const { error } = await db.from("matches").insert({
    winner_id: winnerId,
    loser_id: next.contestantIds[0] === winnerId ? next.contestantIds[1] : next.contestantIds[0],
    category_id: row.category_id,
    ...ownerColumns(person),
    rated: row.rated,
    tournament_id: row.id,
    round: next.round,
    bracket_match: next.index,
  });
  if (error?.code === "23505") throw new GameError("That match was already picked.");
  if (error) throw error;

  const finished = bracket.matchesLeft === 1;
  check(
    await db
      .from("tournaments")
      .update({
        can_undo: true,
        status: finished ? "finished" : "in_progress",
        finished_at: finished ? new Date().toISOString() : null,
      })
      .eq("id", row.id),
  );
}

/** Takes back the person's most recent pick, once, as long as they haven't picked the next match. */
export async function undoLastPick(db: SupabaseClient, person: Person, tournamentId: string): Promise<void> {
  const { row, bracket } = await requireOwnTournament(db, person, tournamentId);
  if (!row.can_undo || bracket.matchesPlayed === 0 || row.status === "given_up") {
    throw new GameError("There's no pick to undo.");
  }

  const claimed = check(
    await db
      .from("tournaments")
      .update({ can_undo: false, status: "in_progress", finished_at: null })
      .eq("id", row.id)
      .eq("can_undo", true)
      .select("id"),
  );
  if (claimed.length === 0) throw new GameError("There's no pick to undo.");

  check(
    await db
      .from("matches")
      .delete()
      .eq("tournament_id", row.id)
      .eq("bracket_match", bracket.matchesPlayed - 1),
  );
}

/** The person's tournaments still in progress, newest first, so they can pick up where they left off. */
export async function listUnfinishedTournaments(db: SupabaseClient, person: Person): Promise<UnfinishedTournament[]> {
  const rows = check(
    await db
      .from("tournaments")
      .select("id, size, created_at, categories(name), matches(count)")
      .match(ownedBy(person))
      .eq("status", "in_progress")
      .order("created_at", { ascending: false }),
  ) as unknown as {
    id: string;
    size: number;
    created_at: string;
    categories: { name: string } | null;
    matches: { count: number }[];
  }[];

  return rows.map((t) => ({
    id: t.id,
    scopeName: t.categories?.name ?? ALL_CONTESTANTS,
    size: t.size,
    matchesLeft: t.size - (t.matches[0]?.count ?? 0),
    createdAt: t.created_at,
  }));
}
