// Closes every session: a thought, not a place. The one check of the session stands here; right after it the
// evening needs again every thing the session used, so a thing left behind is found out in the same session
// (user finding 2026-11-23: a day later is too long ago to be effective). The app never says whether the answer
// to the check was right: the finds show it.
export const evening = {
  id: 'evening',
  time: 'evening',
  closer: true,
  steps: [
    { id: 'dusk', kind: 'tell' },
    { id: 'look', kind: 'check' },
    { id: 'need', kind: 'needAgain' },
    // a story screen after the finds, so the player can still put away what the evening needed
    { id: 'bed', kind: 'tell' },
  ],
};
