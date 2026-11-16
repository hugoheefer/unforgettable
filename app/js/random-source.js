// The only place that knows where randomness comes from; the game gets it injected.

/** @param {() => number} next a number generator giving values in [0, 1) */
export function createRandomSource(next = Math.random) {
  return {
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle(list) {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
