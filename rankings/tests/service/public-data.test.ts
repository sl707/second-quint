import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTournament, pickWinner, startTournament } from "@/server/game";
import { createCategory, newVerifiedVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();
const anyone = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
  auth: { persistSession: false },
});

afterAll(() => removeTestData(db));

describe("public data", () => {
  it("lets anyone read contestants, categories, tournaments, and matches", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = await newVerifiedVisitor(db);
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    const next = (await getTournament(db, visitor, tournamentId))!.bracket.next!;
    await pickWinner(db, visitor, tournamentId, next.contestantIds[0]);

    const memberships = await anyone.from("category_memberships").select("contestant_id, contestants(name), categories(name)").eq("category_id", categoryId);
    expect(memberships.data).toHaveLength(4);
    const matches = await anyone.from("matches").select("winner_id, rated").eq("tournament_id", tournamentId);
    expect(matches.data).toEqual([{ winner_id: next.contestantIds[0], rated: false }]);
  });

  it("never reveals anonymous visitor IDs", async () => {
    expect((await anyone.from("matches").select("visitor_id").limit(1)).error).not.toBeNull();
    expect((await anyone.from("tournaments").select("visitor_id").limit(1)).error).not.toBeNull();
  });

  it("allows no writes from the browser", async () => {
    const { error } = await anyone.from("categories").insert({ name: "Test category sneaky" });
    expect(error).not.toBeNull();
  });
});
