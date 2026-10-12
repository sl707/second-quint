import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { chooseDisplayName, findPlayerByUser, getProfile, ProfileError } from "@/server/profiles";
import { newUser, removeTestData, uniqueDisplayName } from "./fixtures";

const db = createAdminClient();
const anyone = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
  auth: { persistSession: false },
});

afterAll(() => removeTestData(db));

describe("choosing a display name", () => {
  it("has no player for a user who just signed in", async () => {
    const { userId } = await newUser(db);
    expect(await findPlayerByUser(db, userId)).toBeNull();
  });

  it("creates the player with the chosen display name", async () => {
    const { userId } = await newUser(db);
    const name = uniqueDisplayName();

    const player = await chooseDisplayName(db, userId, `  ${name} `);

    expect(player.displayName).toBe(name);
    expect(await findPlayerByUser(db, userId)).toEqual(player);
  });

  it("refuses a display name already taken, ignoring case", async () => {
    const name = uniqueDisplayName("Taken");
    await chooseDisplayName(db, (await newUser(db)).userId, name);
    const { userId } = await newUser(db);

    await expect(chooseDisplayName(db, userId, name.toUpperCase())).rejects.toThrow(
      new ProfileError("That display name is taken."),
    );
    expect(await findPlayerByUser(db, userId)).toBeNull();
  });

  it("refuses display names shorter than 3 or longer than 24 characters", async () => {
    const { userId } = await newUser(db);

    await expect(chooseDisplayName(db, userId, "ab")).rejects.toThrow(ProfileError);
    await expect(chooseDisplayName(db, userId, "a".repeat(25))).rejects.toThrow(ProfileError);
    expect(await findPlayerByUser(db, userId)).toBeNull();
  });

  it("enforces the length and case-insensitive uniqueness rules in the database too", async () => {
    const name = uniqueDisplayName();
    await chooseDisplayName(db, (await newUser(db)).userId, name);
    const { userId } = await newUser(db);

    expect((await db.from("players").insert({ user_id: userId, display_name: "ab" })).error).not.toBeNull();
    expect((await db.from("players").insert({ user_id: userId, display_name: name.toUpperCase() })).error?.code).toBe(
      "23505",
    );
  });

  it("is chosen once; a player can't pick another", async () => {
    const { userId } = await newUser(db);
    await chooseDisplayName(db, userId, uniqueDisplayName());

    await expect(chooseDisplayName(db, userId, uniqueDisplayName())).rejects.toThrow(ProfileError);
  });
});

describe("profiles", () => {
  it("finds a profile by display name in any case, or by player ID", async () => {
    const player = await chooseDisplayName(db, (await newUser(db)).userId, uniqueDisplayName("Prof"));

    expect(await getProfile(db, player.displayName.toLowerCase())).toEqual(player);
    expect(await getProfile(db, player.id)).toEqual(player);
    expect(await getProfile(db, "nobody_here")).toBeNull();
  });

  it("never carries the player's real name or email", async () => {
    const user = await newUser(db);
    const player = await chooseDisplayName(db, user.userId, uniqueDisplayName());

    const json = JSON.stringify(await getProfile(db, player.id));
    expect(json).not.toContain(user.email);
    expect(json).not.toContain(user.fullName);
  });

  it("lets anyone read display names but not which auth user a player is", async () => {
    const player = await chooseDisplayName(db, (await newUser(db)).userId, uniqueDisplayName());

    const { data } = await anyone.from("players").select("id, display_name").eq("id", player.id);
    expect(data).toEqual([{ id: player.id, display_name: player.displayName }]);
    expect((await anyone.from("players").select("user_id").limit(1)).error).not.toBeNull();
    expect((await anyone.from("players").insert({ display_name: "sneaky" })).error).not.toBeNull();
  });
});
