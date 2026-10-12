import type { SupabaseClient } from "@supabase/supabase-js";
import { allowanceDay, nextAllowanceReset, RATED_SKIPS_PER_DAY, ratedAllowance } from "@/domain/allowance/allowance";
import { unratedReasonMessage, type UnratedReason } from "@/domain/allowance/rated-status";
import { INFINITE_MODE_MIN_SCOPE, pickInfinitePair, UNJUDGED_RATING } from "@/domain/infinite/pairing";
import { drawBracket, playBracket, type BracketState, type Random, type Slot } from "@/domain/tournament/bracket";
import { matchCountFor } from "@/domain/tournament/match-count";
import { MIN_TOURNAMENT_SIZE, tournamentSizeOptions, type TournamentSizeOptions } from "@/domain/tournament/size";
import { GameError } from "@/server/game-error";
import { claimSignedOutPick } from "@/server/human-check";

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

/** `removed`: ended because one of its contestants or its category was deleted. */
export type TournamentStatus = "in_progress" | "finished" | "given_up" | "removed";

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
  rated: boolean;
  matchesLeft: number;
  createdAt: string;
};

/** A tournament as anyone may see it on its player's profile. */
export type PastTournament = {
  id: string;
  scopeName: string;
  size: number;
  rated: boolean;
  status: TournamentStatus;
  createdAt: string;
  /** The tournament ranking once finished; null while in progress, after giving up, or once removed. */
  ranking: { place: string; contestants: ContestantCard[] }[] | null;
};

export { GameError };

const ALL_CONTESTANTS = "All contestants";
const PAGE = 1000;

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

const BANNED = "Your account is banned, so you can't play.";

/** Whether `person` is a banned player; signed-out visitors never are. */
export async function isBanned(db: SupabaseClient, person: Person | null): Promise<boolean> {
  if (!person || !("playerId" in person)) return false;
  const row = check(await db.from("players").select("banned").eq("id", person.playerId).maybeSingle()) as { banned: boolean } | null;
  return row?.banned ?? false;
}

async function requireNotBanned(db: SupabaseClient, person: Person): Promise<void> {
  if (await isBanned(db, person)) throw new GameError(BANNED);
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

/** The scope's contestants by name, for hand-picking a tournament. */
export async function listScopeContestants(db: SupabaseClient, categoryId: ScopeId): Promise<ContestantCard[]> {
  await scopeName(db, categoryId);
  const cards: ContestantCard[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      categoryId === null
        ? await db
            .from("contestants")
            .select("id, name, picture_512_url, picture_128_url")
            .is("merged_into", null)
            .order("name")
            .order("id")
            .range(from, from + PAGE - 1)
        : await db
            .from("contestants")
            .select("id, name, picture_512_url, picture_128_url, category_memberships!inner(category_id)")
            .eq("category_memberships.category_id", categoryId)
            .order("name")
            .order("id")
            .range(from, from + PAGE - 1),
    ) as { id: string; name: string; picture_512_url: string; picture_128_url: string }[];
    cards.push(...rows.map((c) => ({ id: c.id, name: c.name, picture512Url: c.picture_512_url, picture128Url: c.picture_128_url })));
    if (rows.length < PAGE) return cards;
  }
}

export type StartTournamentOptions = {
  categoryId: ScopeId;
  /** How many contestants to draw at random; ignored when `contestantIds` hand-picks them. */
  size?: number;
  /** Hand-picks the tournament's contestants from the scope (at least 4); the tournament is then always unrated. */
  contestantIds?: string[];
  /** The signed-in player chose to play unrated. */
  unrated?: boolean;
  /** Start only if the tournament will be rated, as the player was told; otherwise throw and start nothing. */
  expectRated?: boolean;
  /** When the tournament starts, which decides the allowance day. */
  now?: Date;
};

export type StartedTournament = { tournamentId: string; rated: boolean; unratedReason: UnratedReason | null };

/**
 * Draws and starts a tournament. It's rated when the rules allow (see `tournamentRatedStatus`), in
 * which case all its matches are reserved against the start day's allowance in the scope.
 */
export async function startTournament(
  db: SupabaseClient,
  person: Person,
  options: StartTournamentOptions,
  random: Random = Math.random,
): Promise<StartedTournament> {
  await requireNotBanned(db, person);
  await scopeName(db, options.categoryId);
  const scope = await scopeContestantIds(db, options.categoryId);
  const sizes = tournamentSizeOptions(scope.length);
  if (!sizes) throw new GameError("A tournament needs a scope of at least 4 contestants.");
  const handPicked = options.contestantIds !== undefined;
  const pool = handPicked ? [...new Set(options.contestantIds)] : scope;
  const size = handPicked ? pool.length : (options.size ?? sizes.default);
  if (handPicked) {
    if (size < MIN_TOURNAMENT_SIZE) throw new GameError(`Pick at least ${MIN_TOURNAMENT_SIZE} contestants.`);
    const inScope = new Set(scope);
    if (!pool.every((id) => inScope.has(id))) throw new GameError("Pick contestants from the tournament's scope.");
  } else if (!Number.isInteger(size) || size < sizes.min || size > sizes.max) {
    throw new GameError(`Tournament size must be from ${sizes.min} to ${sizes.max}.`);
  }

  const signedIn = "playerId" in person;
  const choseUnrated = signedIn && options.unrated === true;
  const now = options.now ?? new Date();
  const allowance = ratedAllowance({ allContestants: options.categoryId === null, contestantCount: scope.length });
  const [started] = check<{ tournament_id: string | null; rated: boolean; unrated_reason: UnratedReason | null }[]>(
    await db.rpc("start_tournament", {
      p_player_id: signedIn ? person.playerId : null,
      p_visitor_id: signedIn ? null : person.visitorId,
      p_category_id: options.categoryId,
      p_size: matchCountFor(size),
      p_bracket: { slots: drawBracket(pool, size, random) },
      p_try_rated: signedIn && !choseUnrated,
      p_require_rated: options.expectRated === true,
      p_day: allowanceDay(now),
      p_allowance: allowance,
      p_hand_picked: handPicked,
    }),
  );
  const unratedReason: UnratedReason | null = started.rated
    ? null
    : handPicked
      ? "hand-picked"
      : !signedIn
        ? "signed-out"
        : choseUnrated
          ? "chose-unrated"
          : started.unrated_reason;
  if (!started.tournament_id) {
    const used = signedIn ? ((await usedAllowance(db, person, allowanceDay(now))).get(options.categoryId) ?? 0) : 0;
    const message = unratedReasonMessage(unratedReason!, { size, remainingAllowance: Math.max(0, allowance - used) });
    throw new GameError(`This tournament can't be rated now. ${message}`);
  }
  return { tournamentId: started.tournament_id, rated: started.rated, unratedReason };
}

/** Rated matches the player has used on `day`, by scope (null = all contestants). */
async function usedAllowance(db: SupabaseClient, player: SignedInPlayer, day: string): Promise<Map<ScopeId, number>> {
  const rows = check(
    await db.from("allowance_use").select("category_id, used").eq("player_id", player.playerId).eq("day", day),
  ) as { category_id: ScopeId; used: number }[];
  return new Map(rows.map((r) => [r.category_id, r.used]));
}

export type ScopeAllowance = { categoryId: ScopeId; name: string; allowance: number; used: number; remaining: number };

export type AllowanceStatus = {
  /** The current allowance day, `YYYY-MM-DD` in New York. */
  day: string;
  /** When the allowance next resets (midnight in New York), as an ISO timestamp. */
  resetsAt: string;
  hasUnfinishedRatedTournament: boolean;
  scopes: ScopeAllowance[];
};

/** The player's rated allowance today in every scope, and whether a rated tournament is unfinished. */
export async function getAllowanceStatus(
  db: SupabaseClient,
  player: SignedInPlayer,
  options: { now?: Date } = {},
): Promise<AllowanceStatus> {
  const now = options.now ?? new Date();
  const day = allowanceDay(now);
  const [scopes, used, unfinished] = await Promise.all([
    listTournamentScopes(db),
    usedAllowance(db, player, day),
    db
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.playerId)
      .eq("rated", true)
      .eq("status", "in_progress"),
  ]);
  if (unfinished.error) throw unfinished.error;

  return {
    day,
    resetsAt: nextAllowanceReset(now).toISOString(),
    hasUnfinishedRatedTournament: (unfinished.count ?? 0) > 0,
    scopes: scopes.map((s) => {
      const allowance = ratedAllowance({ allContestants: s.categoryId === null, contestantCount: s.contestantCount });
      const usedToday = used.get(s.categoryId) ?? 0;
      return { categoryId: s.categoryId, name: s.name, allowance, used: usedToday, remaining: Math.max(0, allowance - usedToday) };
    }),
  };
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
  const matches = check(
    await db
      .from("matches")
      .select("winnerId:winner_id, loserId:loser_id, bracketMatch:bracket_match")
      .eq("tournament_id", tournamentId)
      .order("bracket_match"),
  ) as { winnerId: string; loserId: string; bracketMatch: number }[];
  // A removed tournament lost a deleted contestant's matches; replay up to the first gap.
  const gap = matches.findIndex((m, i) => m.bracketMatch !== i);
  const picks = (gap === -1 ? matches : matches.slice(0, gap)).map(({ winnerId, loserId }) => ({ winnerId, loserId }));
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
 * Where and when a pick is made. A signed-out visitor's pick needs a passed human check
 * (`verifyVisitor`) and is rate-limited per visitor and per IP.
 */
export type SignedOutPickContext = { ip?: string | null; now?: Date };

/**
 * Records the person's pick for the tournament's next match. Passing the `matchIndex` they
 * were shown guards against a repeated tap landing on the following match.
 */
export async function pickWinner(
  db: SupabaseClient,
  person: Person,
  tournamentId: string,
  winnerId: string,
  options: { matchIndex?: number } & SignedOutPickContext = {},
): Promise<void> {
  await requireNotBanned(db, person);
  const { row, bracket } = await requireOwnTournament(db, person, tournamentId);
  const next = bracket.next;
  if (row.status !== "in_progress" || !next) throw new GameError("This tournament has no match left to pick.");
  if (options.matchIndex !== undefined && options.matchIndex !== next.index) {
    throw new GameError("That match was already picked.");
  }
  if (!next.contestantIds.includes(winnerId)) throw new GameError("That contestant isn't in the current match.");
  if (!("playerId" in person)) await claimSignedOutPick(db, person, options);

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
      .eq("id", row.id)
      .eq("status", "in_progress"),
  );
}

/**
 * Ends the player's unfinished rated tournament early. Its played matches stay counted, it gets no
 * tournament ranking, and its reserved allowance stays spent, so the player can start another.
 */
export async function giveUpTournament(db: SupabaseClient, person: Person, tournamentId: string): Promise<void> {
  const ended = check(
    await db
      .from("tournaments")
      .update({ status: "given_up", can_undo: false, finished_at: new Date().toISOString() })
      .eq("id", tournamentId)
      .match(ownedBy(person))
      .eq("rated", true)
      .eq("status", "in_progress")
      .select("id"),
  );
  if (ended.length === 0) throw new GameError("Only an unfinished rated tournament can be given up.");
}

/** Takes back the person's most recent pick, once, as long as they haven't picked the next match. */
export async function undoLastPick(db: SupabaseClient, person: Person, tournamentId: string): Promise<void> {
  await requireNotBanned(db, person);
  const { row, bracket } = await requireOwnTournament(db, person, tournamentId);
  const undoable: TournamentStatus[] = ["in_progress", "finished"];
  if (!row.can_undo || bracket.matchesPlayed === 0 || !undoable.includes(row.status)) {
    throw new GameError("There's no pick to undo.");
  }

  const claimed = check(
    await db
      .from("tournaments")
      .update({ can_undo: false, status: "in_progress", finished_at: null })
      .eq("id", row.id)
      .eq("can_undo", true)
      .in("status", undoable)
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

export type InfiniteUnratedReason = "signed-out" | "chose-unrated" | "allowance-used-up";

/** Whether picking from the pair now would be rated, with what's left today, or why not. */
export type InfinitePlayStatus =
  | { rated: true; ratedPicksLeft: number; ratedSkipsLeft: number }
  | { rated: false; reason: InfiniteUnratedReason };

export type InfinitePair = {
  pairId: string;
  categoryId: ScopeId;
  scopeName: string;
  contestants: [ContestantCard, ContestantCard];
  play: InfinitePlayStatus;
};

export type InfinitePick = { rated: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InfinitePairRow = { id: string; category_id: ScopeId; first_contestant_id: string; second_contestant_id: string };

const INFINITE_PAIR_COLUMNS = "id, category_id, first_contestant_id, second_contestant_id";

/** `filter` arguments matching rows in the scope (`category_id` null = all contestants). */
function inScope(categoryId: ScopeId) {
  return ["category_id", categoryId === null ? "is" : "eq", categoryId] as const;
}

async function offeredPair(db: SupabaseClient, person: Person, categoryId: ScopeId, choseUnrated: boolean) {
  return check(
    await db
      .from("infinite_pairs")
      .select(INFINITE_PAIR_COLUMNS)
      .match(ownedBy(person))
      .filter(...inScope(categoryId))
      .eq("chose_unrated", choseUnrated)
      // A fresh signal opts out of Next.js memoizing identical GETs within one render, so a pair
      // offered moments ago by this same render is seen.
      .abortSignal(new AbortController().signal)
      .maybeSingle(),
  ) as InfinitePairRow | null;
}

/**
 * The scope's latest global rated ratings and match counts, for pairing. Contestants the rated
 * list hasn't judged are left out.
 */
async function latestRatings(db: SupabaseClient, categoryId: ScopeId) {
  const list = check(
    await db
      .from("ranking_lists")
      .select("id")
      .filter(...inScope(categoryId))
      .eq("rated", true)
      .order("refreshed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { id: number } | null;
  const ratings = new Map<string, { rating: number; matches: number }>();
  if (!list) return ratings;
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      await db
        .from("ranking_entries")
        .select("contestant_id, rating, matches")
        .eq("list_id", list.id)
        .eq("judged", true)
        .order("position")
        .range(from, from + PAGE - 1),
    ) as { contestant_id: string; rating: number; matches: number }[];
    for (const r of rows) ratings.set(r.contestant_id, { rating: r.rating, matches: r.matches });
    if (rows.length < PAGE) return ratings;
  }
}

async function drawInfinitePair(db: SupabaseClient, scope: string[], categoryId: ScopeId, random: Random) {
  const ratings = await latestRatings(db, categoryId);
  return pickInfinitePair(
    scope.map((id) => ({ id, ...(ratings.get(id) ?? { rating: UNJUDGED_RATING, matches: 0 }) })),
    random,
  );
}

/**
 * The pair the person is being offered in Infinite Mode on the scope. The same pair comes back
 * until they pick a winner or skip it; then a new one is drawn, favoring contestants with few
 * matches and close ratings (see `pickInfinitePair`).
 */
export async function getInfinitePair(
  db: SupabaseClient,
  person: Person,
  categoryId: ScopeId,
  {
    random = Math.random,
    unrated = false,
    now = new Date(),
  }: { random?: Random; /** The signed-in player chose to play unrated. */ unrated?: boolean; now?: Date } = {},
): Promise<InfinitePair> {
  await requireNotBanned(db, person);
  const choseUnrated = "playerId" in person && unrated;
  const name = await scopeName(db, categoryId);
  const scope = await scopeContestantIds(db, categoryId);
  if (scope.length < INFINITE_MODE_MIN_SCOPE) throw new GameError("Infinite Mode needs a scope of at least 2 contestants.");

  let row = await offeredPair(db, person, categoryId, choseUnrated);
  if (row && !(scope.includes(row.first_contestant_id) && scope.includes(row.second_contestant_id))) {
    check(await db.from("infinite_pairs").delete().eq("id", row.id));
    row = null;
  }
  if (!row) {
    const [first, second] = await drawInfinitePair(db, scope, categoryId, random);
    const { data, error } = await db
      .from("infinite_pairs")
      .insert({
        ...ownerColumns(person),
        category_id: categoryId,
        chose_unrated: choseUnrated,
        first_contestant_id: first,
        second_contestant_id: second,
      })
      .select(INFINITE_PAIR_COLUMNS)
      .single();
    if (error && error.code !== "23505") throw error;
    // On a conflict another request offered a pair first; offer that one.
    row = data ?? (await offeredPair(db, person, categoryId, choseUnrated))!;
  }

  const ids = [row.first_contestant_id, row.second_contestant_id];
  const cards = check(
    await db.from("contestants").select("id, name, picture_512_url, picture_128_url").in("id", ids),
  ) as { id: string; name: string; picture_512_url: string; picture_128_url: string }[];
  const card = (id: string): ContestantCard => {
    const c = cards.find((c) => c.id === id)!;
    return { id: c.id, name: c.name, picture512Url: c.picture_512_url, picture128Url: c.picture_128_url };
  };
  const play = await infinitePlayStatus(db, person, categoryId, { choseUnrated, scopeSize: scope.length, now });
  return { pairId: row.id, categoryId, scopeName: name, contestants: [card(ids[0]), card(ids[1])], play };
}

async function infinitePlayStatus(
  db: SupabaseClient,
  person: Person,
  categoryId: ScopeId,
  { choseUnrated, scopeSize, now }: { choseUnrated: boolean; scopeSize: number; now: Date },
): Promise<InfinitePlayStatus> {
  if (!("playerId" in person)) return { rated: false, reason: "signed-out" };
  if (choseUnrated) return { rated: false, reason: "chose-unrated" };
  const day = allowanceDay(now);
  const [used, skips] = await Promise.all([
    usedAllowance(db, person, day),
    db.from("skip_use").select("used").eq("player_id", person.playerId).eq("day", day).maybeSingle(),
  ]);
  const allowance = ratedAllowance({ allContestants: categoryId === null, contestantCount: scopeSize });
  const ratedPicksLeft = Math.max(0, allowance - (used.get(categoryId) ?? 0));
  if (ratedPicksLeft === 0) return { rated: false, reason: "allowance-used-up" };
  const skipsUsed = (check(skips) as { used: number } | null)?.used ?? 0;
  return { rated: true, ratedPicksLeft, ratedSkipsLeft: Math.max(0, RATED_SKIPS_PER_DAY - skipsUsed) };
}

const PAIR_GONE = "That pair was already picked or skipped.";
const OUT_OF_SKIPS = `You've used your ${RATED_SKIPS_PER_DAY} rated skips for today. Pick a winner, or play unrated to skip freely.`;

/** The person's offered pair with that ID, or a `GameError` if it was already picked or skipped. */
async function requireOfferedPair(db: SupabaseClient, person: Person, pairId: string) {
  if (!UUID.test(pairId)) throw new GameError(PAIR_GONE);
  const row = check(
    await db.from("infinite_pairs").select(INFINITE_PAIR_COLUMNS).eq("id", pairId).match(ownedBy(person)).maybeSingle(),
  ) as InfinitePairRow | null;
  if (!row) throw new GameError(PAIR_GONE);
  return row;
}

/** The player's rated allowance per day in the scope. */
async function scopeAllowance(db: SupabaseClient, categoryId: ScopeId): Promise<number> {
  const { count, error } =
    categoryId === null
      ? await db.from("contestants").select("id", { count: "exact", head: true }).is("merged_into", null)
      : await db.from("category_memberships").select("contestant_id", { count: "exact", head: true }).eq("category_id", categoryId);
  if (error) throw error;
  return ratedAllowance({ allContestants: categoryId === null, contestantCount: count ?? 0 });
}

/**
 * Records the person's pick from their offered Infinite Mode pair as a match in the pair's scope.
 * It's rated, and uses one allowance, when a signed-in player has allowance left in the scope today.
 */
export async function pickInfiniteWinner(
  db: SupabaseClient,
  person: Person,
  { pairId, winnerId }: { pairId: string; winnerId: string },
  { now = new Date(), ip = null }: SignedOutPickContext = {},
): Promise<InfinitePick> {
  await requireNotBanned(db, person);
  const row = await requireOfferedPair(db, person, pairId);
  if (winnerId !== row.first_contestant_id && winnerId !== row.second_contestant_id) {
    throw new GameError("That contestant isn't in the current pair.");
  }
  const signedIn = "playerId" in person;
  if (!signedIn) await claimSignedOutPick(db, person, { now, ip });
  const [picked] = check<{ claimed: boolean; rated: boolean }[]>(
    await db.rpc("pick_infinite_pair", {
      p_pair_id: row.id,
      p_player_id: signedIn ? person.playerId : null,
      p_visitor_id: signedIn ? null : person.visitorId,
      p_winner_id: winnerId,
      p_day: allowanceDay(now),
      p_allowance: signedIn ? await scopeAllowance(db, row.category_id) : 0,
    }),
  );
  if (!picked.claimed) throw new GameError(PAIR_GONE);
  return { rated: picked.rated };
}

/** Passes on the person's offered Infinite Mode pair without recording a match. */
export async function skipInfinitePair(
  db: SupabaseClient,
  person: Person,
  { pairId }: { pairId: string },
  { now = new Date() }: { now?: Date } = {},
): Promise<void> {
  await requireNotBanned(db, person);
  const row = await requireOfferedPair(db, person, pairId);
  const signedIn = "playerId" in person;
  const [skipped] = check<{ outcome: "skipped" | "gone" | "out-of-skips" }[]>(
    await db.rpc("skip_infinite_pair", {
      p_pair_id: row.id,
      p_player_id: signedIn ? person.playerId : null,
      p_visitor_id: signedIn ? null : person.visitorId,
      p_day: allowanceDay(now),
      p_allowance: signedIn ? await scopeAllowance(db, row.category_id) : 0,
      p_skip_limit: RATED_SKIPS_PER_DAY,
    }),
  );
  if (skipped.outcome === "gone") throw new GameError(PAIR_GONE);
  if (skipped.outcome === "out-of-skips") throw new GameError(OUT_OF_SKIPS);
}

/** How many of a player's most recent tournaments their profile shows. */
export const PAST_TOURNAMENTS_SHOWN = 50;

/**
 * The player's most recent tournaments, newest first, for their public profile: finished ones with
 * their tournament ranking, the rest without.
 */
export async function listPastTournaments(db: SupabaseClient, playerId: string): Promise<PastTournament[]> {
  const rows = check(
    await db
      .from("tournaments")
      .select("id, size, rated, status, bracket, created_at, categories(name)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(PAST_TOURNAMENTS_SHOWN),
  ) as unknown as (Omit<TournamentRow, "category_id" | "can_undo"> & { categories: { name: string } | null })[];

  const finishedIds = rows.filter((t) => t.status === "finished").map((t) => t.id);
  const picks = new Map<string, { winnerId: string; loserId: string }[]>(finishedIds.map((id) => [id, []]));
  for (let from = 0; finishedIds.length > 0; from += PAGE) {
    const batch = check(
      await db
        .from("matches")
        .select("tournamentId:tournament_id, winnerId:winner_id, loserId:loser_id")
        .in("tournament_id", finishedIds)
        .order("tournament_id")
        .order("bracket_match")
        .range(from, from + PAGE - 1),
    ) as { tournamentId: string; winnerId: string; loserId: string }[];
    for (const { tournamentId, ...pick } of batch) picks.get(tournamentId)!.push(pick);
    if (batch.length < PAGE) break;
  }

  const rankings = new Map(
    rows
      .filter((t) => t.status === "finished")
      .map((t) => [t.id, playBracket(t.bracket.slots, picks.get(t.id)!).ranking ?? []]),
  );
  const ids = [...new Set([...rankings.values()].flatMap((tiers) => tiers.flatMap((tier) => tier.contestantIds)))];
  const cards = new Map<string, ContestantCard>();
  for (let i = 0; i < ids.length; i += PAGE) {
    const batch = check(
      await db.from("contestants").select("id, name, picture_512_url, picture_128_url").in("id", ids.slice(i, i + PAGE)),
    ) as { id: string; name: string; picture_512_url: string; picture_128_url: string }[];
    for (const c of batch) cards.set(c.id, { id: c.id, name: c.name, picture512Url: c.picture_512_url, picture128Url: c.picture_128_url });
  }

  return rows.map((t) => ({
    id: t.id,
    scopeName: t.categories?.name ?? ALL_CONTESTANTS,
    size: t.size,
    rated: t.rated,
    status: t.status,
    createdAt: t.created_at,
    ranking:
      rankings.get(t.id)?.map((tier) => ({
        place: tier.place,
        contestants: tier.contestantIds.flatMap((id) => cards.get(id) ?? []),
      })) ?? null,
  }));
}

/** The person's tournaments still in progress, newest first, so they can pick up where they left off. */
export async function listUnfinishedTournaments(db: SupabaseClient, person: Person): Promise<UnfinishedTournament[]> {
  const rows = check(
    await db
      .from("tournaments")
      .select("id, size, rated, created_at, categories(name), matches(count)")
      .match(ownedBy(person))
      .eq("status", "in_progress")
      .order("created_at", { ascending: false }),
  ) as unknown as {
    id: string;
    size: number;
    rated: boolean;
    created_at: string;
    categories: { name: string } | null;
    matches: { count: number }[];
  }[];

  return rows.map((t) => ({
    id: t.id,
    scopeName: t.categories?.name ?? ALL_CONTESTANTS,
    size: t.size,
    rated: t.rated,
    matchesLeft: t.size - (t.matches[0]?.count ?? 0),
    createdAt: t.created_at,
  }));
}
