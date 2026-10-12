import { bracketSizeFor } from "./bracket";

/** Where a match sits in a bracket. `fromFinal` orders stages: 0 is the final, larger is earlier. */
export type Stage = { name: string; fromFinal: number };

function roundName(fromFinal: number): string {
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinals";
  if (fromFinal === 2) return "Quarterfinals";
  return `Round of ${2 ** (fromFinal + 1)}`;
}

/**
 * The stage of the match at `index` in a tournament of `size` contestants' play order: the real
 * (non-bye) first-round matches, then each later round, with the third-place match just before the
 * final, as `playBracket` plays them.
 */
export function stageOfMatch(size: number, index: number): Stage {
  if (!Number.isInteger(index) || index < 0 || index >= size) {
    throw new Error(`A tournament of ${size} has no match ${index}`);
  }
  const bracketSize = bracketSizeFor(size);
  const rounds = Math.log2(bracketSize);
  let start = 0;
  for (let round = 1; round < rounds; round++) {
    const matches = round === 1 ? size - bracketSize / 2 : bracketSize / 2 ** round;
    if (index < start + matches) return { name: roundName(rounds - round), fromFinal: rounds - round };
    start += matches;
  }
  return index === size - 2 ? { name: "Third-place match", fromFinal: 0.5 } : { name: "Final", fromFinal: 0 };
}
