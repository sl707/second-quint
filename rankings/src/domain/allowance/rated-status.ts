import { matchCountFor } from "@/domain/tournament/match-count";

export type UnratedReason =
  | "signed-out"
  | "chose-unrated"
  | "hand-picked"
  | "unfinished-rated-tournament"
  | "not-enough-allowance";

export type RatedStatus = { rated: true } | { rated: false; reason: UnratedReason };

export type RatedStatusInput = {
  signedIn: boolean;
  choseUnrated: boolean;
  handPicked: boolean;
  hasUnfinishedRatedTournament: boolean;
  size: number;
  remainingAllowance: number;
};

/** Whether a tournament would be rated if started now, and why not when it wouldn't. */
export function tournamentRatedStatus(input: RatedStatusInput): RatedStatus {
  const unrated = (reason: UnratedReason): RatedStatus => ({ rated: false, reason });
  if (!input.signedIn) return unrated("signed-out");
  if (input.choseUnrated) return unrated("chose-unrated");
  if (input.handPicked) return unrated("hand-picked");
  if (input.hasUnfinishedRatedTournament) return unrated("unfinished-rated-tournament");
  if (matchCountFor(input.size) > input.remainingAllowance) return unrated("not-enough-allowance");
  return { rated: true };
}

/** Why a tournament will be unrated, in words for the player. */
export function unratedReasonMessage(
  reason: UnratedReason,
  { size, remainingAllowance }: { size: number; remainingAllowance: number },
): string {
  switch (reason) {
    case "signed-out":
      return "You're signed out. Sign in to play rated tournaments.";
    case "chose-unrated":
      return "You chose to play unrated.";
    case "hand-picked":
      return "Hand-picked tournaments are always unrated.";
    case "unfinished-rated-tournament":
      return "You already have an unfinished rated tournament. Finish it or give it up to start another rated one.";
    case "not-enough-allowance":
      return `Its ${matchCountFor(size)} matches don't fit in your remaining rated allowance for this scope today (${remainingAllowance} left).`;
  }
}
