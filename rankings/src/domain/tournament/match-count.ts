/** A tournament of N contestants plays N − 1 bracket matches plus a third-place match. */
export function matchCountFor(contestants: number): number {
  if (!Number.isInteger(contestants) || contestants < 4) {
    throw new Error("A tournament needs at least 4 contestants");
  }
  return contestants;
}
