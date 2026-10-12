/** A category's creator can edit its details while it has fewer contestants than this. */
export const CATEGORY_CREATOR_EDIT_LIMIT = 10;

export const MAX_CATEGORY_DESCRIPTION_LENGTH = 280;

type Who = { isCreator: boolean; isAdmin: boolean };

/** Editing a contestant's name and picture, or deleting it: its creator until its first rated match, then only the admin. */
export function canEditContestant({ isCreator, isAdmin, hasRatedMatch }: Who & { hasRatedMatch: boolean }): boolean {
  return isAdmin || (isCreator && !hasRatedMatch);
}

/** Editing a category's name and description: its creator until it has 10 contestants, then only the admin. */
export function canEditCategory({ isCreator, isAdmin, contestantCount }: Who & { contestantCount: number }): boolean {
  return isAdmin || (isCreator && contestantCount < CATEGORY_CREATOR_EDIT_LIMIT);
}

/** Choosing a category's cover: its creator, or the admin. */
export function canChooseCover({ isCreator, isAdmin }: Who): boolean {
  return isAdmin || isCreator;
}
