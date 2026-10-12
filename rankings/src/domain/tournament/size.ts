export const MIN_TOURNAMENT_SIZE = 4;
export const DEFAULT_TOURNAMENT_SIZE = 16;

export type TournamentSizeOptions = { min: number; max: number; default: number };

/** The sizes a tournament can have in a scope of `scopeSize` contestants, or null if the scope is too small. */
export function tournamentSizeOptions(scopeSize: number): TournamentSizeOptions | null {
  if (scopeSize < MIN_TOURNAMENT_SIZE) return null;
  return { min: MIN_TOURNAMENT_SIZE, max: scopeSize, default: Math.min(DEFAULT_TOURNAMENT_SIZE, scopeSize) };
}
