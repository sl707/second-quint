import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateRanking, type RankingMatch } from "@/domain/ranking/ranking";
import type { ContestantCard, ScopeId } from "@/server/game";

/** Global rankings fade matches with a 30-day half-life, so they follow changing tastes. */
export const GLOBAL_HALF_LIFE_DAYS = 30;

const OVERALL_RANKING = "Overall Ranking";
const PAGE = 1000;

export type RankingRow = {
  position: number;
  contestant: ContestantCard;
  rating: number;
  range: number;
  score: number;
  wins: number;
  losses: number;
  matches: number;
};

export type GlobalRanking = {
  categoryId: ScopeId;
  scopeName: string;
  /** Rated Ranking (only rated matches) or Unrated Ranking (every match) */
  rated: boolean;
  /** null until the ranking refresher has run since the scope was created */
  refreshedAt: string | null;
  ranked: RankingRow[];
  notYetJudged: ContestantCard[];
};

/** One player's ranking, computed on request from their own matches with no fading. */
export type PersonalRanking = Omit<GlobalRanking, "refreshedAt">;

export type RankingScope = { categoryId: ScopeId; name: string };

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const batch = check(await page(from, from + PAGE - 1)) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

type MatchRow = { id: number; winner_id: string; loser_id: string; category_id: string | null; played_at: string; rated: boolean };

async function readCountedMatches(db: SupabaseClient): Promise<MatchRow[]> {
  const rows: MatchRow[] = [];
  for (let after = 0; ; ) {
    const batch = check(
      await db
        .from("matches")
        .select("id, winner_id, loser_id, category_id, played_at, rated")
        .eq("excluded", false)
        .gt("id", after)
        .order("id")
        .limit(PAGE),
    ) as MatchRow[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
    after = batch[batch.length - 1].id;
  }
}

/**
 * Recomputes every global ranking (each category plus overall, each in a rated and an unrated
 * version) from all counted matches and stores the ready-made lists. A category's matches feed
 * its own ranking and the overall ranking; matches drawn from all contestants feed only the
 * overall ranking. Rated rankings use only rated matches; unrated rankings use every match.
 */
export async function refreshGlobalRankings(
  db: SupabaseClient,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ lists: number; matches: number }> {
  const [matchRows, contestants, memberships, categories] = await Promise.all([
    readCountedMatches(db),
    readAll<{ id: string }>((from, to) =>
      db.from("contestants").select("id").is("merged_into", null).order("name").order("id").range(from, to),
    ),
    readAll<{ category_id: string; contestant_id: string; contestants: { name: string } }>((from, to) =>
      db
        .from("category_memberships")
        .select("category_id, contestant_id, contestants!inner(name)")
        .order("category_id")
        .order("contestant_id")
        .range(from, to),
    ),
    readAll<{ id: string }>((from, to) => db.from("categories").select("id").order("id").range(from, to)),
  ]);

  const membersByCategory = new Map<string, { id: string; name: string }[]>(categories.map((c) => [c.id, []]));
  for (const m of memberships) membersByCategory.get(m.category_id)?.push({ id: m.contestant_id, name: m.contestants.name });
  const scopes: { categoryId: ScopeId; contestantIds: string[] }[] = [
    { categoryId: null, contestantIds: contestants.map((c) => c.id) },
    ...[...membersByCategory].map(([categoryId, members]) => ({
      categoryId,
      contestantIds: members.sort((a, b) => a.name.localeCompare(b.name)).map((m) => m.id),
    })),
  ];

  let lists = 0;
  for (const rated of [true, false]) {
    const { all, byCategory } = groupByScope(rated ? matchRows.filter((m) => m.rated) : matchRows);
    for (const scope of scopes) {
      const matches = scope.categoryId === null ? all : (byCategory.get(scope.categoryId) ?? []);
      const ranking = calculateRanking(matches, { contestantIds: scope.contestantIds, halfLifeDays: GLOBAL_HALF_LIFE_DAYS, now });
      await storeList(db, scope.categoryId, rated, now, ranking);
      lists++;
    }
  }

  return { lists, matches: matchRows.length };
}

function groupByScope(rows: MatchRow[]) {
  const byCategory = new Map<string, RankingMatch[]>();
  const all = rows.map((m) => {
    const match = { winnerId: m.winner_id, loserId: m.loser_id, playedAt: new Date(m.played_at) };
    if (m.category_id) {
      const list = byCategory.get(m.category_id) ?? [];
      list.push(match);
      byCategory.set(m.category_id, list);
    }
    return match;
  });
  return { all, byCategory };
}

async function storeList(
  db: SupabaseClient,
  categoryId: ScopeId,
  rated: boolean,
  now: Date,
  ranking: ReturnType<typeof calculateRanking>,
) {
  const entries = [
    ...ranking.ranked.map((r, i) => ({
      contestant_id: r.contestantId,
      position: i + 1,
      judged: true,
      rating: r.rating,
      range: r.range,
      score: r.score,
      wins: r.wins,
      losses: r.losses,
      matches: r.matches,
    })),
    ...ranking.notYetJudged.map((contestantId, i) => ({
      contestant_id: contestantId,
      position: ranking.ranked.length + i + 1,
      judged: false,
    })),
  ];
  check(
    await db.rpc("store_ranking_list", {
      p_category_id: categoryId,
      p_rated: rated,
      p_refreshed_at: now.toISOString(),
      p_entries: entries,
    }),
  );
}

/** The Overall Ranking followed by every Category Ranking, by name. */
export async function listRankingScopes(db: SupabaseClient): Promise<RankingScope[]> {
  const categories = check(await db.from("categories").select("id, name").order("name")) as { id: string; name: string }[];
  return [{ categoryId: null, name: OVERALL_RANKING }, ...categories.map((c) => ({ categoryId: c.id, name: c.name }))];
}

/** The player's Overall Ranking followed by a Category Ranking for each category they've played, by name. */
export async function listPersonalRankingScopes(db: SupabaseClient, playerId: string): Promise<RankingScope[]> {
  const matches = await readAll<{ category_id: string }>((from, to) =>
    db
      .from("matches")
      .select("category_id")
      .eq("player_id", playerId)
      .eq("excluded", false)
      .not("category_id", "is", null)
      .order("id")
      .range(from, to),
  );
  const ids = [...new Set(matches.map((m) => m.category_id))];
  const categories = ids.length
    ? (check(await db.from("categories").select("id, name").in("id", ids).order("name")) as { id: string; name: string }[])
    : [];
  return [{ categoryId: null, name: OVERALL_RANKING }, ...categories.map((c) => ({ categoryId: c.id, name: c.name }))];
}

type CardRow = { id: string; name: string; picture_512_url: string; picture_128_url: string };

const CARD_COLUMNS = "id, name, picture_512_url, picture_128_url";

function card(c: CardRow): ContestantCard {
  return { id: c.id, name: c.name, picture512Url: c.picture_512_url, picture128Url: c.picture_128_url };
}

/** The scope's contestants by name; null if the category doesn't exist. */
async function scopeContestants(db: SupabaseClient, categoryId: ScopeId): Promise<{ name: string; cards: CardRow[] } | null> {
  if (categoryId === null) {
    const cards = await readAll<CardRow>((from, to) =>
      db.from("contestants").select(CARD_COLUMNS).is("merged_into", null).order("name").order("id").range(from, to),
    );
    return { name: OVERALL_RANKING, cards };
  }
  const category = check(await db.from("categories").select("name").eq("id", categoryId).maybeSingle()) as { name: string } | null;
  if (!category) return null;
  const members = await readAll<{ contestants: CardRow }>((from, to) =>
    db
      .from("category_memberships")
      .select(`contestants!inner(${CARD_COLUMNS})`)
      .eq("category_id", categoryId)
      .order("contestant_id")
      .range(from, to),
  );
  const cards = members.map((m) => m.contestants).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { name: category.name, cards };
}

/**
 * The player's Personal Ranking for a category, or their Overall Ranking, in its rated or unrated
 * version; null if the category doesn't exist. Computed now from only the player's own counted
 * matches, every one weighing the same however old, so it reflects their latest pick. Contestants
 * they haven't judged are listed as not yet judged, never filled in from global ratings.
 */
export async function getPersonalRanking(
  db: SupabaseClient,
  playerId: string,
  categoryId: ScopeId,
  { rated }: { rated: boolean },
): Promise<PersonalRanking | null> {
  const [scope, matchRows] = await Promise.all([
    scopeContestants(db, categoryId),
    readAll<{ winner_id: string; loser_id: string; played_at: string }>((from, to) => {
      let query = db.from("matches").select("winner_id, loser_id, played_at").eq("player_id", playerId).eq("excluded", false);
      if (categoryId !== null) query = query.eq("category_id", categoryId);
      if (rated) query = query.eq("rated", true);
      return query.order("id").range(from, to);
    }),
  ]);
  if (!scope) return null;

  const cards = new Map(scope.cards.map((c) => [c.id, card(c)]));
  const ranking = calculateRanking(
    matchRows.map((m) => ({ winnerId: m.winner_id, loserId: m.loser_id, playedAt: new Date(m.played_at) })),
    { contestantIds: [...cards.keys()], halfLifeDays: null, now: new Date() },
  );
  return {
    categoryId,
    scopeName: scope.name,
    rated,
    ranked: ranking.ranked.map((r, i) => ({
      position: i + 1,
      contestant: cards.get(r.contestantId)!,
      rating: r.rating,
      range: r.range,
      score: r.score,
      wins: r.wins,
      losses: r.losses,
      matches: r.matches,
    })),
    notYetJudged: ranking.notYetJudged.map((id) => cards.get(id)!),
  };
}

type EntryRow = {
  position: number;
  judged: boolean;
  rating: number | null;
  range: number | null;
  score: number | null;
  wins: number | null;
  losses: number | null;
  matches: number | null;
  contestants: CardRow;
};

/**
 * The latest stored global ranking for a category, or the Overall Ranking, in its rated or unrated
 * version; null if the category doesn't exist.
 */
export async function getGlobalRanking(
  db: SupabaseClient,
  categoryId: ScopeId,
  { rated }: { rated: boolean },
): Promise<GlobalRanking | null> {
  let scopeName = OVERALL_RANKING;
  if (categoryId !== null) {
    const category = check(await db.from("categories").select("name").eq("id", categoryId).maybeSingle()) as { name: string } | null;
    if (!category) return null;
    scopeName = category.name;
  }

  const listQuery = db.from("ranking_lists").select("id, refreshed_at").eq("rated", rated);
  const list = check(
    await (categoryId === null ? listQuery.is("category_id", null) : listQuery.eq("category_id", categoryId))
      .order("refreshed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { id: number; refreshed_at: string } | null;
  if (!list) return { categoryId, scopeName, rated, refreshedAt: null, ranked: [], notYetJudged: [] };

  const entries = await readAll<EntryRow>((from, to) =>
    db
      .from("ranking_entries")
      .select("position, judged, rating, range, score, wins, losses, matches, contestants!inner(id, name, picture_512_url, picture_128_url)")
      .eq("list_id", list.id)
      .order("position")
      .range(from, to),
  );

  return {
    categoryId,
    scopeName,
    rated,
    refreshedAt: list.refreshed_at,
    ranked: entries
      .filter((e) => e.judged)
      .map((e) => ({
        position: e.position,
        contestant: card(e.contestants),
        rating: e.rating!,
        range: e.range!,
        score: e.score!,
        wins: e.wins!,
        losses: e.losses!,
        matches: e.matches!,
      })),
    notYetJudged: entries.filter((e) => !e.judged).map((e) => card(e.contestants)),
  };
}
