// The clock port: the only place that knows what day it is, so the game logic can be tested with a fixed date.

const twoDigits = (number) => String(number).padStart(2, '0');

/** @param {() => Date} now */
export function createClock(now = () => new Date()) {
  return {
    /** The local date as `YYYY-MM-DD`. */
    today() {
      const date = now();
      return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
    },
  };
}
