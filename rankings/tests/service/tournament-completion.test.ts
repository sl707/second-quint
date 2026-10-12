import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, getTournamentCompletion } from "@/server/admin";
import { getTournament, giveUpTournament, pickWinner, startTournament, type Person } from "@/server/game";
import { createCategory, makeAdmin, newPlayer, newVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function play(person: Person, tournamentId: string, picks: number) {
  for (let i = 0; i < picks; i++) {
    const next = (await getTournament(db, person, tournamentId))!.bracket.next!;
    await pickWinner(db, person, tournamentId, next.contestantIds[0]);
  }
}

/** A New York calendar day no other test plays on. */
function uniquePastDay(offsetDays = 0) {
  const day = new Date(Date.UTC(1990, 0, 1) + (Math.floor(Math.random() * 3000) * 3 + offsetDays) * 86_400_000);
  return day.toISOString().slice(0, 10);
}

async function startedOn(day: string, ...tournamentIds: string[]) {
  const { error } = await db.from("tournaments").update({ created_at: `${day}T16:00:00Z` }).in("id", tournamentIds);
  if (error) throw error;
}

describe("tournament completion", () => {
  it("shows the admin how many tournaments were finished, given up, and left in progress, and where they stopped", async () => {
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);
    const four = await createCategory(db, 4);
    const five = await createCategory(db, 5);
    const player = await newPlayer(db);
    const other = await newPlayer(db);
    const visitor = newVisitor();

    const finished = await startTournament(db, player, { categoryId: four.categoryId, size: 4 });
    await play(player, finished.tournamentId, 4);
    const givenUp = await startTournament(db, player, { categoryId: four.categoryId, size: 4 });
    await play(player, givenUp.tournamentId, 1);
    await giveUpTournament(db, player, givenUp.tournamentId);
    const ratedInProgress = await startTournament(db, other, { categoryId: five.categoryId, size: 5 });
    await play(other, ratedInProgress.tournamentId, 3);
    const notStarted = await startTournament(db, visitor, { categoryId: four.categoryId, size: 4 });
    const unratedInProgress = await startTournament(db, player, { categoryId: four.categoryId, size: 4, play: "unrated" });
    await play(player, unratedInProgress.tournamentId, 2);
    expect([finished, givenUp, ratedInProgress, notStarted, unratedInProgress].map((t) => t.rated)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    const nextDay = await startTournament(db, other, { categoryId: four.categoryId, size: 4, play: "unrated" });

    const day = uniquePastDay();
    const dayAfter = new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10);
    await startedOn(day, finished.tournamentId, givenUp.tournamentId, ratedInProgress.tournamentId, notStarted.tournamentId, unratedInProgress.tournamentId);
    await startedOn(dayAfter, nextDay.tournamentId);

    const completion = await getTournamentCompletion(db, admin, { from: day, to: day });

    expect(completion.overall).toEqual({ total: 5, finished: 1, givenUp: 1, inProgress: 3, removed: 0 });
    expect(completion.rated).toEqual({ total: 3, finished: 1, givenUp: 1, inProgress: 1, removed: 0 });
    expect(completion.unrated).toEqual({ total: 2, finished: 0, givenUp: 0, inProgress: 2, removed: 0 });
    // The given-up tournament and the unplayed one stopped at a semifinal; the 4-contestant one with
    // two picks and the 5-contestant one with three picks were both at the third-place match.
    expect(completion.stoppedAt).toEqual([
      { stage: "Semifinals", inProgress: 1, givenUp: 1 },
      { stage: "Third-place match", inProgress: 2, givenUp: 0 },
    ]);

    const twoDays = await getTournamentCompletion(db, admin, { from: day, to: dayAfter });
    expect(twoDays.overall.total).toBe(6);
    expect(twoDays.unrated.inProgress).toBe(3);
    expect(twoDays.stoppedAt).toEqual([
      { stage: "Semifinals", inProgress: 2, givenUp: 1 },
      { stage: "Third-place match", inProgress: 2, givenUp: 0 },
    ]);
  });

  it("is for the admin only", async () => {
    const player = await newPlayer(db);
    await expect(getTournamentCompletion(db, player, {})).rejects.toThrow(AdminError);
    await expect(getTournamentCompletion(db, null, {})).rejects.toThrow(AdminError);
  });
});
