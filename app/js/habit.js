// How well each item's habit is going. Pure. The hint level is computed from the streak, never stored.

const DIMMED_FROM_STREAK = 2;
const HIDDEN_FROM_STREAK = 4;

export const streakOf = (progress, itemId) => progress.streaks[itemId] ?? 0;

/** Returns new progress: the streak grows when the item went to its home spot and restarts otherwise. */
export function recordPlacement(progress, itemId, atHome) {
  const streak = atHome ? streakOf(progress, itemId) + 1 : 0;
  return { ...progress, streaks: { ...progress.streaks, [itemId]: streak } };
}

/** @returns {'shown' | 'dimmed' | 'hidden'} how visible the home spot is made to the player */
export function hintLevel(streak) {
  if (streak >= HIDDEN_FROM_STREAK) return 'hidden';
  return streak >= DIMMED_FROM_STREAK ? 'dimmed' : 'shown';
}
