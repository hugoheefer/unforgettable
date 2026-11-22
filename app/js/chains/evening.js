// Closes every session: a thought, not a place. The one check of the session stands here, so a thing left
// behind is not found out right after the story that left it, but only when it is needed.
export const evening = {
  id: 'evening',
  time: 'evening',
  closer: true,
  steps: [
    { id: 'dusk', kind: 'tell' },
    { id: 'look', kind: 'check' },
  ],
};
