// The questions the app asks during a round, one screen at a time: a command and the choices the player can
// make. The player picks one and taps Next. Pure: it drives a Round and holds no DOM.
//
// A screen is { lead: string[], command: string, choices: { id, label, mark? }[], selected: string | null }.
// Choice ids: 'spots' | 'pockets' | 'doors' | 'hang:<garment>' | 'puton:<garment>' open a list; inside a list
// 'spot:<id>' | 'pocket:<garment>/<pocket>' | 'door:<room>' act; 'back' returns to the first question.

import { describeLocation, describeRoom } from './room-view.js';

const HINT_MARK = '★';
const BACK = { id: 'back', label: '↩ Choose something else' };

const movesLeftText = (count) => `${count} ${count === 1 ? 'move' : 'moves'} left`;
const markOf = (hint) => (hint === 'hidden' ? undefined : HINT_MARK);
const withMark = (choice, hint) => (markOf(hint) ? { ...choice, mark: markOf(hint) } : choice);
const seenText = (tile) => (tile.seen.length > 0 ? ` ${tile.seen.join(' ')}` : '');

export class PlayFlow {
  /**
   * @param {import('./round.js').Round} round
   * @param {{ onFinished?: () => void }} [options] `onFinished` is called once, when the last thing is found
   */
  constructor(round, { onFinished = () => {} } = {}) {
    this.round = round;
    this.onFinished = onFinished;
    this.menu = { type: 'root' };
    this.selected = null;
    this.lead = [];
    this.interlude = null; // the distraction screen between dropping and searching
  }

  isFinished() {
    return this.round.state().phase === 'done';
  }

  step() {
    if (this.interlude) return { lead: this.lead, command: this.interlude, choices: [], selected: null };
    const state = this.round.state();
    const view = describeRoom(this.round);
    const { command, choices } = this.question(state, view);
    const lead = [...this.lead];
    if (state.phase === 'drop') {
      lead.push(`⏱ ${state.pressure} ${movesLeftText(state.movesLeft)}.`);
      if (view.hintText) lead.push(view.hintText);
    }
    return { lead, command, choices, selected: this.selected };
  }

  question(state, view) {
    const dropping = state.phase === 'drop';
    const item = this.round.items.find((candidate) => candidate.id === (state.holding ?? state.findItem));
    switch (this.menu.type) {
      case 'spots':
        return { command: dropping ? `Which spot in the ${view.room.name}?` : `Which spot do you look at in the ${view.room.name}?`, choices: this.spotChoices(view) };
      case 'pockets':
        return { command: dropping ? 'Which pocket?' : 'Which pocket do you look in?', choices: this.pocketChoices(view) };
      case 'doors':
        return { command: 'Where do you walk to?', choices: [...view.exits.map((exit) => ({ id: `door:${exit.id}`, label: `${exit.icon} ${exit.name}` })), BACK] };
      case 'hang': {
        const garment = this.round.garmentOf(this.menu.garmentId);
        return { command: `Where do you hang your ${garment.name.toLowerCase()}?`, choices: this.spotChoices(view) };
      }
      default:
        return dropping
          ? { command: `You are in the ${view.room.name}. Where do you put your ${item.icon} ${item.name}?`, choices: this.rootChoices(view, dropping) }
          : { command: `${state.findPrompt} You are in the ${view.room.name}.`, choices: this.rootChoices(view, dropping) };
    }
  }

  rootChoices(view, dropping) {
    const verb = dropping ? 'Put it' : 'Look';
    const choices = [
      { id: 'spots', label: dropping ? `${verb} in this room (${view.room.name})` : `${verb} at a spot in this room (${view.room.name})` },
    ];
    if (this.reachablePockets(view).length > 0) choices.push({ id: 'pockets', label: `${verb} in a pocket` });
    choices.push({ id: 'doors', label: 'Walk to another room' });
    if (dropping) {
      for (const garment of view.worn) if (garment.canTakeOff) choices.push({ id: `hang:${garment.id}`, label: `Take off my ${garment.name.toLowerCase()}` });
      for (const garment of view.hanging) choices.push({ id: `puton:${garment.id}`, label: `Put my ${garment.name.toLowerCase()} on` });
    }
    return choices;
  }

  reachablePockets(view) {
    return [...view.worn, ...view.hanging].flatMap((garment) =>
      garment.pockets.map((pocket) => ({ garment, pocket, hangs: view.hanging.includes(garment) })));
  }

  spotChoices(view) {
    return [...view.spots.map((spot) => withMark({ id: `spot:${spot.id}`, label: `${spot.icon} ${spot.name}${seenText(spot)}` }, spot.hint)), BACK];
  }

  pocketChoices(view) {
    const pockets = this.reachablePockets(view).map(({ garment, pocket, hangs }) =>
      withMark({ id: `pocket:${garment.id}/${pocket.id}`, label: `${pocket.icon} ${pocket.name} (${garment.name}${hangs ? ', hangs here' : ''})${seenText(pocket)}` }, pocket.hint));
    return [...pockets, BACK];
  }

  choose(choiceId) {
    if (!this.step().choices.some((choice) => choice.id === choiceId)) throw new Error(`Choice not offered: ${choiceId}`);
    this.selected = choiceId;
  }

  next() {
    if (this.interlude) {
      this.interlude = null;
      this.lead = [];
      return;
    }
    const choice = this.selected;
    if (!choice) return;
    this.selected = null;
    this.lead = [];
    const phaseBefore = this.round.state().phase;
    try {
      this.apply(choice);
    } catch (error) {
      this.lead = [error.message];
    }
    const state = this.round.state();
    if (state.notice) this.lead.push(state.notice);
    if (phaseBefore === 'drop' && state.phase === 'find') this.interlude = state.distraction;
    if (phaseBefore !== 'done' && state.phase === 'done') this.onFinished();
  }

  apply(choice) {
    if (choice === 'back') {
      this.menu = { type: 'root' };
      return;
    }
    const [kind, rest] = choice.split(/:(.*)/s);
    if (kind === 'spots' || kind === 'pockets' || kind === 'doors') this.menu = { type: kind };
    else if (kind === 'hang') this.menu = { type: 'hang', garmentId: rest };
    else this.act(kind, rest);
  }

  /** Does what the player chose, then goes back to the first question. */
  act(kind, rest) {
    const state = this.round.state();
    const dropping = state.phase === 'drop';
    const itemId = state.holding ?? state.findItem;
    const menu = this.menu;
    this.menu = { type: 'root' };
    if (kind === 'puton') {
      this.round.putOn(rest);
      this.lead = [`You put your ${this.round.garmentOf(rest).name.toLowerCase()} on.`];
    } else if (kind === 'door') {
      this.round.walkTo(rest);
    } else if (menu.type === 'hang') {
      this.round.takeOff(menu.garmentId, rest);
      this.lead = [`You hung your ${this.round.garmentOf(menu.garmentId).name.toLowerCase()} on the ${this.spotName(rest)}.`];
    } else if (dropping) {
      if (kind === 'pocket') this.round.putInPocket(...rest.split('/'));
      else this.round.putDown(rest);
      this.lead = [this.placedText(itemId)];
    } else {
      const outcome = kind === 'pocket' ? this.round.openPocket(...rest.split('/')) : this.round.open(rest);
      this.lead = [this.lookedText(itemId, outcome)];
    }
  }

  spotName(spotId) {
    return this.round.roomOf(this.round.state().roomId).spots.find((spot) => spot.id === spotId).name;
  }

  placedText(itemId) {
    const item = this.round.items.find((candidate) => candidate.id === itemId);
    const result = this.round.results().find((entry) => entry.itemId === itemId);
    if (result.atHome) return `✔ Your ${item.icon} ${item.name} is on its home spot.`;
    const where = describeLocation(this.round, result.location);
    return `You left your ${item.icon} ${item.name} here: ${where}. Your plan was: ${describeLocation(this.round, this.round.plan[itemId])}.`;
  }

  lookedText(itemId, outcome) {
    const item = this.round.items.find((candidate) => candidate.id === itemId);
    if (outcome.found) {
      const cost = this.round.results().find((entry) => entry.itemId === itemId).findCost;
      return `Found your ${item.icon} ${item.name}! It took ${cost} ${cost === 1 ? 'move' : 'moves'}.`;
    }
    const seen = outcome.items.map((id) => this.round.items.find((candidate) => candidate.id === id).icon);
    return seen.length > 0 ? `Not here. You see ${seen.join(' ')}.` : 'Not here.';
  }
}
