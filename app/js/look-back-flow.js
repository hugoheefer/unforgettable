// Looking at the screens of the session that were left, one at a time and read only: nothing here changes the
// game, so the screen shows what it showed, what was chosen on it, and only ways to move through the screens.
// Pure. It starts at the screen left last; one tap on Next goes one screen earlier.

import { choiceNotOffered, noScreensToLookAt } from './errors.js';

/** The label of each choice in the texts; the table is also the list of the ids that exist. */
const LABELS = {
  earlier: (texts) => texts.lookBackEarlier,
  later: (texts) => texts.lookBackLater,
  return: (texts) => texts.lookBackReturn,
};

export class LookBackFlow {
  /**
   * @param {{ entries: { lead: string[], command: string, picked: string | null }[], texts: object, onReturn: () => void }} options
   *   `onReturn` is called once, when the player goes back to the game
   */
  constructor({ entries, texts, onReturn }) {
    if (entries.length === 0) throw noScreensToLookAt();
    this.entries = structuredClone(entries);
    this.texts = texts;
    this.onReturn = onReturn;
    this.index = entries.length - 1;
    this.finished = false;
    this.selected = this.defaultChoice();
    // what each choice does; a new way of moving is a new row here and in LABELS
    this.moves = {
      earlier: () => { this.index -= 1; },
      later: () => { this.index += 1; },
      return: () => { this.finished = true; this.onReturn(); },
    };
  }

  isFinished() {
    return this.finished;
  }

  offered() {
    return [...(this.index > 0 ? ['earlier'] : []), ...(this.index < this.entries.length - 1 ? ['later'] : []), 'return'];
  }

  /** One tap goes further back while there is something earlier; at the oldest screen the way out is selected. */
  defaultChoice() {
    return this.index > 0 ? 'earlier' : 'return';
  }

  step() {
    const { lead, command, picked } = this.entries[this.index];
    return {
      lead: [this.texts.lookBackNote, ...lead],
      command: this.texts.lookBackCommand({ command, picked }),
      choices: this.offered().map((id) => ({ id, label: LABELS[id](this.texts) })),
      selected: this.selected,
    };
  }

  choose(choiceId) {
    if (!this.offered().includes(choiceId)) throw choiceNotOffered(choiceId);
    this.selected = choiceId;
  }

  next() {
    if (this.finished) return;
    this.moves[this.selected]();
    this.selected = this.finished ? null : this.defaultChoice();
  }
}
