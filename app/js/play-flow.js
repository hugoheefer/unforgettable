// The questions the app asks during a round, one screen at a time: a command and the choices the player can
// make. The player picks one and taps Next. Pure: it drives a Round and holds no DOM.
//
// A screen is { lead: string[], command: string, choices: { id, label, mark? }[], selected: string | null }.
// Choice ids: 'spots' | 'pockets' | 'doors' | 'hang:<garment>' | 'puton:<garment>' open a list; inside a list
// 'spot:<id>' | 'pocket:<garment>/<pocket>' | 'door:<room>' act; 'back' returns to the first question.

import { describeLocation, describeRoom } from './room-view.js';
import { RefusedMove, choiceNotOffered } from './errors.js';
import { named } from './names.js';

const HINT_MARK = '★';

const markOf = (hint) => (hint === 'hidden' ? undefined : HINT_MARK);
const withMark = (choice, hint) => (markOf(hint) ? { ...choice, mark: markOf(hint) } : choice);

export class PlayFlow {
  /**
   * @param {import('./round.js').Round} round
   * @param {{ texts: object, onFinished?: () => void }} options `onFinished` is called once, when the last thing is found
   */
  constructor(round, { texts, onFinished = () => {} }) {
    this.round = round;
    this.texts = texts;
    this.onFinished = onFinished;
    this.back = { id: 'back', label: texts.back };
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
    const view = describeRoom(this.round, this.texts);
    const { command, choices } = this.question(state, view);
    const lead = [...this.lead];
    if (state.phase === 'drop') {
      lead.push(this.texts.dropStatus({ pressure: state.pressure, movesLeft: state.movesLeft }));
      if (view.hintText) lead.push(view.hintText);
    }
    return { lead, command, choices, selected: this.selected };
  }

  question(state, view) {
    const { texts } = this;
    const dropping = state.phase === 'drop';
    switch (this.menu.type) {
      case 'spots':
        return { command: (dropping ? texts.spotsDropping : texts.spotsFinding)({ room: view.room }), choices: this.spotChoices(view) };
      case 'pockets':
        return { command: dropping ? texts.whichPocketDropping : texts.whichPocketFinding, choices: this.pocketChoices(view) };
      case 'doors':
        return { command: texts.walkWhere, choices: [...view.exits.map((exit) => ({ id: `door:${exit.id}`, label: texts.tileLabel(exit) })), this.back] };
      case 'hang': {
        const garment = named(texts.garments, this.round.garmentOf(this.menu.garmentId));
        return { command: texts.hangWhere({ garment }), choices: this.spotChoices(view) };
      }
      default:
        return dropping
          ? { command: texts.putCommand({ room: view.room, thing: this.thingOf(state.holding) }), choices: this.rootChoices(view, dropping) }
          : { command: texts.findCommand({ prompt: state.findPrompt, room: view.room }), choices: this.rootChoices(view, dropping) };
    }
  }

  thingOf(itemId) {
    return named(this.texts.things, this.round.items.find((candidate) => candidate.id === itemId));
  }

  rootChoices(view, dropping) {
    const { texts } = this;
    const choices = [
      { id: 'spots', label: dropping ? texts.putInRoom({ room: view.room }) : texts.lookAtSpot({ room: view.room }) },
    ];
    if (this.reachablePockets(view).length > 0) choices.push({ id: 'pockets', label: dropping ? texts.putInPocket : texts.lookInPocket });
    choices.push({ id: 'doors', label: texts.walkToRoom });
    if (dropping) {
      for (const garment of view.worn) if (garment.canTakeOff) choices.push({ id: `hang:${garment.id}`, label: texts.takeOff({ garment }) });
      for (const garment of view.hanging) choices.push({ id: `puton:${garment.id}`, label: texts.putOn({ garment }) });
    }
    return choices;
  }

  reachablePockets(view) {
    return [...view.worn, ...view.hanging].flatMap((garment) =>
      garment.pockets.map((pocket) => ({ garment, pocket, hangs: view.hanging.includes(garment) })));
  }

  spotChoices(view) {
    return [...view.spots.map((spot) => withMark({ id: `spot:${spot.id}`, label: this.texts.tileLabel(spot) }, spot.hint)), this.back];
  }

  pocketChoices(view) {
    const pockets = this.reachablePockets(view).map(({ garment, pocket, hangs }) =>
      withMark({ id: `pocket:${garment.id}/${pocket.id}`, label: this.texts.pocketLabel({ pocket, garment, hangs, seen: pocket.seen }) }, pocket.hint));
    return [...pockets, this.back];
  }

  choose(choiceId) {
    if (!this.step().choices.some((choice) => choice.id === choiceId)) throw choiceNotOffered(choiceId);
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
      if (!(error instanceof RefusedMove)) throw error;
      this.lead = [this.texts.refusals[error.code]];
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
    const { texts } = this;
    this.menu = { type: 'root' };
    if (kind === 'puton') {
      this.round.putOn(rest);
      this.lead = [texts.putOnDone({ garment: named(texts.garments, this.round.garmentOf(rest)) })];
    } else if (kind === 'door') {
      this.round.walkTo(rest);
    } else if (menu.type === 'hang') {
      this.round.takeOff(menu.garmentId, rest);
      this.lead = [texts.hungDone({ garment: named(texts.garments, this.round.garmentOf(menu.garmentId)), spot: this.spotOf(rest) })];
    } else if (dropping) {
      if (kind === 'pocket') this.round.putInPocket(...rest.split('/'));
      else this.round.putDown(rest);
      this.lead = [this.placedText(itemId)];
    } else {
      const outcome = kind === 'pocket' ? this.round.openPocket(...rest.split('/')) : this.round.open(rest);
      this.lead = [this.lookedText(itemId, outcome)];
    }
  }

  spotOf(spotId) {
    return named(this.texts.spots, this.round.roomOf(this.round.state().roomId).spots.find((spot) => spot.id === spotId));
  }

  placedText(itemId) {
    const thing = this.thingOf(itemId);
    const result = this.round.results().find((entry) => entry.itemId === itemId);
    if (result.atHome) return this.texts.placedHome({ thing });
    return this.texts.placedAway({
      thing,
      where: describeLocation(this.round, result.location, this.texts),
      plan: describeLocation(this.round, this.round.plan[itemId], this.texts),
    });
  }

  lookedText(itemId, outcome) {
    const thing = this.thingOf(itemId);
    if (outcome.found) {
      const cost = this.round.results().find((entry) => entry.itemId === itemId).findCost;
      return this.texts.found({ thing, cost });
    }
    const seen = outcome.items.map((id) => this.round.items.find((candidate) => candidate.id === id).icon);
    return seen.length > 0 ? this.texts.notHereSee({ seen }) : this.texts.notHere;
  }
}
