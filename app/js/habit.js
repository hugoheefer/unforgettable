// How well each item's habit is going. Pure.

/** Progress of a new game: no streaks. */
export const emptyProgress = () => ({ streaks: {} });

export const streakOf = (progress, itemId) => progress.streaks[itemId] ?? 0;

/** Returns new progress: the streak grows when the item went to its home spot and restarts otherwise. */
export function recordPlacement(progress, itemId, atHome) {
  const streak = atHome ? streakOf(progress, itemId) + 1 : 0;
  return { ...progress, streaks: { ...progress.streaks, [itemId]: streak } };
}
