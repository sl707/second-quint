import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_CREATOR_EDIT_LIMIT,
  canChooseCover,
  canEditCategory,
  canEditContestant,
  MAX_CATEGORY_DESCRIPTION_LENGTH,
  MAX_REPORT_REASON_LENGTH,
} from "@/domain/catalog/permissions";
import { MAX_STORED_PICTURE_BYTES, storedPictureType } from "@/domain/picture/picture";
import type { ContestantCard, Person, SignedInPlayer } from "@/server/game";

/** Who added a contestant or category: a player, "deleted" once they've deleted their account, or null for sample entries. */
export type Contributor = { id: string; displayName: string } | "deleted" | null;

export type Contestant = {
  id: string;
  name: string;
  picture512Url: string;
  picture128Url: string;
  createdBy: Contributor;
  createdAt: string;
};

/** A picture already resized in the browser: center-cropped squares at 512 and 128 px. */
export type ResizedPicture = { picture512: Uint8Array; picture128: Uint8Array };

/** A catalog rule was broken; the message is safe to show to the player. */
export class CatalogError extends Error {}

const PICTURE_BUCKET = "pictures";
const ONE_YEAR_SECONDS = "31536000";
const MAX_NAME_LENGTH = 80;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTESTANT_COLUMNS =
  "id, name, picture_512_url, picture_128_url, created_at, players!contestants_created_by_fkey(id, display_name)";

/** The deleted-player tombstone is the only player with no display name. */
type ContributorRow = { id: string; display_name: string | null } | null;
type ContestantRow = {
  id: string;
  name: string;
  picture_512_url: string;
  picture_128_url: string;
  created_at: string;
  players: ContributorRow;
};

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

const contributor = (row: ContributorRow): Contributor =>
  !row ? null : row.display_name === null ? "deleted" : { id: row.id, displayName: row.display_name };

function toContestant(row: ContestantRow): Contestant {
  return {
    id: row.id,
    name: row.name,
    picture512Url: row.picture_512_url,
    picture128Url: row.picture_128_url,
    createdBy: contributor(row.players),
    createdAt: row.created_at,
  };
}

type Actor = { id: string; isAdmin: boolean };

async function findActor(db: SupabaseClient, player: SignedInPlayer | null): Promise<(Actor & { banned: boolean }) | null> {
  if (!player) return null;
  const row = check(
    await db.from("players").select("id, is_admin, banned").eq("id", player.playerId).maybeSingle(),
  ) as { id: string; is_admin: boolean; banned: boolean } | null;
  return row && { id: row.id, isAdmin: row.is_admin, banned: row.banned };
}

/** The player making a catalog change; banned players can't add to the catalog. */
async function actor(db: SupabaseClient, player: SignedInPlayer): Promise<Actor> {
  const found = await findActor(db, player);
  if (!found) throw new CatalogError("Sign in to add to the catalog.");
  if (found.banned) throw new CatalogError("Banned players can't change the catalog.");
  return found;
}

/** Who is looking, for showing edit controls; banned players and visitors get none. */
async function viewer(db: SupabaseClient, player: SignedInPlayer | null): Promise<Actor | null> {
  const found = await findActor(db, player);
  return found && !found.banned ? found : null;
}

function checkName(input: string, what: string): string {
  const name = input.trim();
  if (!name) throw new CatalogError(`Give the ${what} a name.`);
  if (name.length > MAX_NAME_LENGTH) throw new CatalogError(`Names can be up to ${MAX_NAME_LENGTH} characters.`);
  return name;
}

/** Stores one resized picture under the SHA-256 of its bytes and returns its public URL. */
async function storePicture(db: SupabaseClient, bytes: Uint8Array): Promise<string> {
  const type = storedPictureType(bytes);
  if (!type) throw new CatalogError("Pictures must be resized to WebP before upload.");
  if (bytes.length > MAX_STORED_PICTURE_BYTES) throw new CatalogError("That picture is too large after resizing.");

  const path = `${createHash("sha256").update(bytes).digest("hex")}.${type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await db.storage
    .from(PICTURE_BUCKET)
    .upload(path, bytes, { contentType: type, cacheControl: ONE_YEAR_SECONDS, upsert: false });
  if (error && !isAlreadyStored(error)) throw error;
  return db.storage.from(PICTURE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function isAlreadyStored(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string };
  return String(e.statusCode ?? e.status) === "409" || /already exists/i.test(e.message ?? "");
}

async function storePictures(db: SupabaseClient, picture: ResizedPicture) {
  const [picture512Url, picture128Url] = await Promise.all([
    storePicture(db, picture.picture512),
    storePicture(db, picture.picture128),
  ]);
  return { picture_512_url: picture512Url, picture_128_url: picture128Url };
}

export type SimilarContestant = { id: string; name: string; picture128Url: string };

/** Existing contestants whose names look like `name`, ignoring case and accents, for "Did you mean…?". */
export async function findSimilarContestants(db: SupabaseClient, name: string): Promise<SimilarContestant[]> {
  if (!name.trim()) return [];
  const rows = check(await db.rpc("similar_contestants", { p_name: name, p_limit: 5 })) as {
    id: string;
    name: string;
    picture_128_url: string;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, picture128Url: r.picture_128_url }));
}

/** Adds a contestant to the catalog; it can be played right away. */
export async function addContestant(
  db: SupabaseClient,
  player: SignedInPlayer,
  input: { name: string } & ResizedPicture,
): Promise<Contestant> {
  const by = await actor(db, player);
  const name = checkName(input.name, "contestant");
  const pictures = await storePictures(db, input);
  const row = check(
    await db
      .from("contestants")
      .insert({ name, ...pictures, created_by: by.id })
      .select(CONTESTANT_COLUMNS)
      .single(),
  ) as unknown as ContestantRow;
  return toContestant(row);
}

export type CategoryDetails = {
  id: string;
  name: string;
  description: string;
  createdBy: Contributor;
  createdAt: string;
  /** The cover the creator chose, or null to show the top contestant */
  chosenCoverId: string | null;
  /** The chosen cover, else the top contestant by score; null only when the category is empty */
  cover: ContestantCard | null;
  /** By name */
  contestants: ContestantCard[];
  /** What the viewer may do */
  canEdit: boolean;
  canChooseCover: boolean;
  canAddContestants: boolean;
  /** The admin: may remove contestants and delete the category */
  canModerate: boolean;
};

type CardRow = { id: string; name: string; picture_512_url: string; picture_128_url: string };
const CARD_COLUMNS = "id, name, picture_512_url, picture_128_url";
const toCard = (c: CardRow): ContestantCard => ({
  id: c.id,
  name: c.name,
  picture512Url: c.picture_512_url,
  picture128Url: c.picture_128_url,
});

function checkDescription(input: string): string {
  const description = input.trim();
  if (description.length > MAX_CATEGORY_DESCRIPTION_LENGTH) {
    throw new CatalogError(`Descriptions can be up to ${MAX_CATEGORY_DESCRIPTION_LENGTH} characters.`);
  }
  return description;
}

/** Creates a category; it can be played as soon as it has enough contestants. */
export async function createCategory(
  db: SupabaseClient,
  player: SignedInPlayer,
  input: { name: string; description: string },
): Promise<{ categoryId: string }> {
  const by = await actor(db, player);
  const row = check(
    await db
      .from("categories")
      .insert({ name: checkName(input.name, "category"), description: checkDescription(input.description), created_by: by.id })
      .select("id")
      .single(),
  ) as { id: string };
  return { categoryId: row.id };
}

type CategoryRow = {
  id: string;
  name: string;
  description: string;
  cover_contestant_id: string | null;
  created_by: string | null;
  created_at: string;
  players: ContributorRow;
};

async function readCategory(db: SupabaseClient, categoryId: string): Promise<CategoryRow> {
  if (!UUID.test(categoryId)) throw new CatalogError("That category doesn't exist.");
  const row = check(
    await db
      .from("categories")
      .select("id, name, description, cover_contestant_id, created_by, created_at, players(id, display_name)")
      .eq("id", categoryId)
      .maybeSingle(),
  ) as unknown as CategoryRow | null;
  if (!row) throw new CatalogError("That category doesn't exist.");
  return row;
}

async function categoryMembers(db: SupabaseClient, categoryId: string): Promise<ContestantCard[]> {
  const rows = check(
    await db.from("category_memberships").select(`contestants!inner(${CARD_COLUMNS})`).eq("category_id", categoryId),
  ) as unknown as { contestants: CardRow }[];
  return rows.map((r) => toCard(r.contestants)).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** The member at the top of the category's latest stored rated ranking. */
async function topContestantId(db: SupabaseClient, categoryId: string, memberIds: Set<string>): Promise<string | null> {
  const list = check(
    await db
      .from("ranking_lists")
      .select("id")
      .eq("category_id", categoryId)
      .eq("rated", true)
      .order("refreshed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { id: number } | null;
  if (!list) return null;
  const entries = check(
    await db.from("ranking_entries").select("contestant_id").eq("list_id", list.id).eq("judged", true).order("position").limit(50),
  ) as { contestant_id: string }[];
  return entries.find((e) => memberIds.has(e.contestant_id))?.contestant_id ?? null;
}

function categoryRights(by: Actor | null, category: CategoryRow, contestantCount: number) {
  const who = { isCreator: !!by && category.created_by === by.id, isAdmin: by?.isAdmin ?? false };
  return {
    canEdit: !!by && canEditCategory({ ...who, contestantCount }),
    canChooseCover: !!by && canChooseCover(who),
    canAddContestants: !!by,
    canModerate: by?.isAdmin ?? false,
  };
}

/** A category with its contestants and cover, and what `player` (if signed in) may do with it; null if it doesn't exist. */
export async function getCategory(
  db: SupabaseClient,
  categoryId: string,
  player: SignedInPlayer | null = null,
): Promise<CategoryDetails | null> {
  let row: CategoryRow;
  try {
    row = await readCategory(db, categoryId);
  } catch (error) {
    if (error instanceof CatalogError) return null;
    throw error;
  }
  const [contestants, by] = await Promise.all([categoryMembers(db, categoryId), viewer(db, player)]);
  const byId = new Map(contestants.map((c) => [c.id, c]));
  const coverId =
    (row.cover_contestant_id && byId.has(row.cover_contestant_id) ? row.cover_contestant_id : null) ??
    (await topContestantId(db, categoryId, new Set(byId.keys()))) ??
    contestants[0]?.id ??
    null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: contributor(row.players),
    createdAt: row.created_at,
    chosenCoverId: row.cover_contestant_id,
    cover: coverId ? byId.get(coverId)! : null,
    contestants,
    ...categoryRights(by, row, contestants.length),
  };
}

async function isMember(db: SupabaseClient, categoryId: string, contestantId: string): Promise<boolean> {
  const { count, error } = await db
    .from("category_memberships")
    .select("contestant_id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("contestant_id", contestantId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Adds an existing contestant to any category; any signed-in player may. */
export async function addContestantToCategory(
  db: SupabaseClient,
  player: SignedInPlayer,
  categoryId: string,
  contestantId: string,
): Promise<void> {
  const by = await actor(db, player);
  await readCategory(db, categoryId);
  if (!UUID.test(contestantId)) throw new CatalogError("That contestant doesn't exist.");
  const contestant = check(
    await db.from("contestants").select("id, merged_into").eq("id", contestantId).maybeSingle(),
  ) as { id: string; merged_into: string | null } | null;
  if (!contestant || contestant.merged_into) throw new CatalogError("That contestant doesn't exist.");

  const { error } = await db
    .from("category_memberships")
    .insert({ category_id: categoryId, contestant_id: contestantId, added_by: by.id });
  if (error?.code === "23505") throw new CatalogError("That contestant is already in this category.");
  if (error) throw error;
}

/** Chooses one of the category's contestants as its cover, or null to show its top contestant. */
export async function setCategoryCover(
  db: SupabaseClient,
  player: SignedInPlayer,
  categoryId: string,
  contestantId: string | null,
): Promise<void> {
  const by = await actor(db, player);
  const category = await readCategory(db, categoryId);
  if (!categoryRights(by, category, 0).canChooseCover) {
    throw new CatalogError("Only the category's creator can choose its cover.");
  }
  if (contestantId !== null && !(UUID.test(contestantId) && (await isMember(db, categoryId, contestantId)))) {
    throw new CatalogError("The cover must be one of the category's contestants.");
  }
  check(await db.from("categories").update({ cover_contestant_id: contestantId }).eq("id", categoryId));
}

/** Edits a category's name and description: its creator until it has 10 contestants, then only the admin. */
export async function editCategory(
  db: SupabaseClient,
  player: SignedInPlayer,
  categoryId: string,
  input: { name: string; description: string },
): Promise<void> {
  const by = await actor(db, player);
  const category = await readCategory(db, categoryId);
  const { count, error } = await db
    .from("category_memberships")
    .select("contestant_id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  if (error) throw error;
  if (!categoryRights(by, category, count ?? 0).canEdit) {
    throw new CatalogError(
      category.created_by === by.id
        ? `Categories with ${CATEGORY_CREATOR_EDIT_LIMIT} or more contestants can only be edited by the admin.`
        : "Only the category's creator can edit it.",
    );
  }
  check(
    await db
      .from("categories")
      .update({ name: checkName(input.name, "category"), description: checkDescription(input.description) })
      .eq("id", categoryId),
  );
}

export type ContestantDetails = Contestant & {
  /** By name */
  categories: { id: string; name: string }[];
  /** Whether the viewer may edit or delete it */
  canEdit: boolean;
};

type OwnedContestant = ContestantRow & { created_by: string | null };

async function readContestant(db: SupabaseClient, contestantId: string): Promise<OwnedContestant | null> {
  if (!UUID.test(contestantId)) return null;
  return check(
    await db
      .from("contestants")
      .select(`${CONTESTANT_COLUMNS}, created_by`)
      .eq("id", contestantId)
      .is("merged_into", null)
      .maybeSingle(),
  ) as unknown as OwnedContestant | null;
}

async function hasRatedMatch(db: SupabaseClient, contestantId: string): Promise<boolean> {
  const rows = check(
    await db
      .from("matches")
      .select("id")
      .eq("rated", true)
      .or(`winner_id.eq.${contestantId},loser_id.eq.${contestantId}`)
      .limit(1),
  ) as unknown[];
  return rows.length > 0;
}

async function mayEditContestant(db: SupabaseClient, by: Actor | null, contestant: OwnedContestant): Promise<boolean> {
  if (!by) return false;
  const isCreator = contestant.created_by === by.id;
  if (!isCreator && !by.isAdmin) return false;
  return canEditContestant({ isCreator, isAdmin: by.isAdmin, hasRatedMatch: await hasRatedMatch(db, contestant.id) });
}

/** A contestant with its categories and whether `player` (if signed in) may edit it; null if it doesn't exist. */
export async function getContestant(
  db: SupabaseClient,
  contestantId: string,
  player: SignedInPlayer | null = null,
): Promise<ContestantDetails | null> {
  const row = await readContestant(db, contestantId);
  if (!row) return null;
  const [memberships, by] = await Promise.all([
    db.from("category_memberships").select("categories!inner(id, name)").eq("contestant_id", contestantId),
    viewer(db, player),
  ]);
  const categories = (check(memberships) as unknown as { categories: { id: string; name: string } }[])
    .map((m) => m.categories)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ...toContestant(row), categories, canEdit: await mayEditContestant(db, by, row) };
}

/** The contestant a merged-away contestant now lives on, for redirecting its page; null if it wasn't merged. */
export async function findMergeSurvivor(db: SupabaseClient, contestantId: string): Promise<string | null> {
  if (!UUID.test(contestantId)) return null;
  const row = check(await db.from("contestants").select("merged_into").eq("id", contestantId).maybeSingle()) as {
    merged_into: string | null;
  } | null;
  return row?.merged_into ?? null;
}

async function editableContestant(db: SupabaseClient, player: SignedInPlayer, contestantId: string) {
  const by = await actor(db, player);
  const contestant = await readContestant(db, contestantId);
  if (!contestant) throw new CatalogError("That contestant doesn't exist.");
  if (!(await mayEditContestant(db, by, contestant))) {
    throw new CatalogError(
      contestant.created_by === by.id
        ? "Contestants that have had a rated match can only be changed by the admin."
        : "Only the contestant's creator can change it.",
    );
  }
  return contestant;
}

/** Removes stored picture files that no contestant uses any more. */
async function removeUnusedPictures(db: SupabaseClient, urls: string[]) {
  const marker = `/object/public/${PICTURE_BUCKET}/`;
  const paths: string[] = [];
  for (const url of new Set(urls)) {
    if (!url.includes(marker)) continue;
    const { count, error } = await db
      .from("contestants")
      .select("id", { count: "exact", head: true })
      .or(`picture_512_url.eq."${url}",picture_128_url.eq."${url}"`);
    if (error) throw error;
    if (!count) paths.push(url.slice(url.indexOf(marker) + marker.length));
  }
  if (paths.length) {
    const { error } = await db.storage.from(PICTURE_BUCKET).remove(paths);
    if (error) throw error;
  }
}

/** Renames a contestant and/or replaces its picture: its creator until its first rated match, then only the admin. */
export async function editContestant(
  db: SupabaseClient,
  player: SignedInPlayer,
  contestantId: string,
  input: { name?: string } & Partial<ResizedPicture>,
): Promise<void> {
  const contestant = await editableContestant(db, player, contestantId);
  const changes: Record<string, string> = {};
  if (input.name !== undefined) changes.name = checkName(input.name, "contestant");
  if (input.picture512 || input.picture128) {
    if (!input.picture512 || !input.picture128) throw new CatalogError("Upload both picture sizes.");
    Object.assign(changes, await storePictures(db, { picture512: input.picture512, picture128: input.picture128 }));
  }
  if (!Object.keys(changes).length) return;
  check(await db.from("contestants").update(changes).eq("id", contestantId));
  if (changes.picture_512_url) {
    await removeUnusedPictures(db, [contestant.picture_512_url, contestant.picture_128_url]);
  }
}

/**
 * Deletes a contestant: its creator until its first rated match, then only the admin. Its own
 * matches go too; tournaments that drew it end as removed, and their other matches still count.
 */
export async function deleteContestant(db: SupabaseClient, player: SignedInPlayer, contestantId: string): Promise<void> {
  await editableContestant(db, player, contestantId);
  const unused = check(await db.rpc("delete_contestant", { p_contestant_id: contestantId })) as string[];
  await removeUnusedPictures(db, unused);
}

export type ReportTargetType = "contestant" | "category" | "profile";

/** What a report is about: a contestant, a category, or a player's profile, by ID. */
export type ReportTarget = { type: ReportTargetType; id: string };

const REPORT_TABLES: Record<ReportTargetType, string> = { contestant: "contestants", category: "categories", profile: "players" };

/** Flags a contestant, category, or profile for the admin, with a short reason. Anyone may, once while it's open. */
export async function reportItem(db: SupabaseClient, person: Person, target: ReportTarget, reasonInput: string): Promise<void> {
  const reason = reasonInput.trim();
  if (!reason) throw new CatalogError("Say briefly what's wrong.");
  if (reason.length > MAX_REPORT_REASON_LENGTH) {
    throw new CatalogError(`Reasons can be up to ${MAX_REPORT_REASON_LENGTH} characters.`);
  }
  const table = REPORT_TABLES[target.type];
  const exists =
    !!table &&
    UUID.test(target.id) &&
    !!check(await db.from(table).select("id").eq("id", target.id).maybeSingle());
  if (!exists) throw new CatalogError("That doesn't exist any more.");
  if ("playerId" in person && (await findActor(db, person))?.banned) throw new CatalogError("Banned players can't report.");

  const { error } = await db.from("reports").insert({
    reporter_player_id: "playerId" in person ? person.playerId : null,
    reporter_visitor_id: "visitorId" in person ? person.visitorId : null,
    target_type: target.type,
    target_id: target.id,
    reason,
  });
  if (error && error.code !== "23505") throw error;
}

export type CategorySummary = {
  id: string;
  name: string;
  description: string;
  contestantCount: number;
  cover: ContestantCard | null;
};

/** Every category by name, with its cover: the chosen one, else its top contestant, else its first by name. */
export async function listCategories(db: SupabaseClient): Promise<CategorySummary[]> {
  const rows = check(
    await db
      .from("categories")
      .select(`id, name, description, category_memberships(count), cover:contestants!categories_cover_contestant_id_fkey(${CARD_COLUMNS})`)
      .order("name"),
  ) as unknown as {
    id: string;
    name: string;
    description: string;
    category_memberships: { count: number }[];
    cover: CardRow | null;
  }[];

  const tops = check(
    await db
      .from("ranking_entries")
      .select(`contestants!inner(${CARD_COLUMNS}), ranking_lists!inner(category_id)`)
      .eq("position", 1)
      .eq("judged", true)
      .eq("ranking_lists.rated", true)
      .not("ranking_lists.category_id", "is", null),
  ) as unknown as { contestants: CardRow; ranking_lists: { category_id: string } }[];
  const topByCategory = new Map(tops.map((t) => [t.ranking_lists.category_id, t.contestants]));

  return Promise.all(
    rows.map(async (row) => {
      const contestantCount = row.category_memberships[0]?.count ?? 0;
      let cover = row.cover ?? topByCategory.get(row.id) ?? null;
      if (!cover && contestantCount > 0) {
        const first = check(
          await db
            .from("category_memberships")
            .select(`contestants!inner(${CARD_COLUMNS})`)
            .eq("category_id", row.id)
            .order("contestants(name)")
            .limit(1),
        ) as unknown as { contestants: CardRow }[];
        cover = first[0]?.contestants ?? null;
      }
      return { id: row.id, name: row.name, description: row.description, contestantCount, cover: cover && toCard(cover) };
    }),
  );
}
