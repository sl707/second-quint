import { describe, expect, it } from "vitest";
import { tournamentRatedStatus, unratedReasonMessage } from "./rated-status";

const eligible = {
  signedIn: true,
  choseUnrated: false,
  handPicked: false,
  hasUnfinishedRatedTournament: false,
  size: 16,
  remainingAllowance: 16,
};

describe("tournamentRatedStatus", () => {
  it("is rated when signed in, randomly drawn, nothing unfinished, and all N matches fit", () => {
    expect(tournamentRatedStatus(eligible)).toEqual({ rated: true });
  });

  it("is unrated for a signed-out visitor", () => {
    expect(tournamentRatedStatus({ ...eligible, signedIn: false })).toEqual({ rated: false, reason: "signed-out" });
  });

  it("is unrated when the player chose unrated", () => {
    expect(tournamentRatedStatus({ ...eligible, choseUnrated: true })).toEqual({ rated: false, reason: "chose-unrated" });
  });

  it("is unrated when the contestants were hand-picked", () => {
    expect(tournamentRatedStatus({ ...eligible, handPicked: true })).toEqual({ rated: false, reason: "hand-picked" });
  });

  it("gives hand-picked as the reason whatever else would make it unrated", () => {
    expect(tournamentRatedStatus({ ...eligible, handPicked: true, choseUnrated: true })).toEqual({
      rated: false,
      reason: "hand-picked",
    });
    expect(tournamentRatedStatus({ ...eligible, handPicked: true, signedIn: false })).toEqual({
      rated: false,
      reason: "hand-picked",
    });
  });

  it("is unrated while another rated tournament is unfinished", () => {
    expect(tournamentRatedStatus({ ...eligible, hasUnfinishedRatedTournament: true })).toEqual({
      rated: false,
      reason: "unfinished-rated-tournament",
    });
  });

  it("is unrated when its N matches don't all fit in the remaining allowance", () => {
    expect(tournamentRatedStatus({ ...eligible, size: 17 })).toEqual({ rated: false, reason: "not-enough-allowance" });
  });

  it("gives the player's own choice before rules they can't change", () => {
    expect(
      tournamentRatedStatus({ ...eligible, choseUnrated: true, hasUnfinishedRatedTournament: true, remainingAllowance: 0 }),
    ).toEqual({ rated: false, reason: "chose-unrated" });
  });
});

describe("unratedReasonMessage", () => {
  it("tells the player how much allowance is left when the tournament doesn't fit", () => {
    expect(unratedReasonMessage("not-enough-allowance", { size: 16, remainingAllowance: 4 })).toBe(
      "Its 16 matches don't fit in your remaining rated allowance for this scope today (4 left).",
    );
  });
});
