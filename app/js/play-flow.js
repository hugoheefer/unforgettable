// The questions the app asks during a day, one screen at a time: a command and the choices the player can
// make. The player picks one and taps Next. Pure: it drives a Day and holds no DOM.
//
// A screen is { lead: string[], command: string, choices: { id, label, mark? }[], selected: string | null,
// canLeave: true }. Choice ids: 'spots' | 'pockets' | 'doors' | 'hang:<garment>' | 'puton:<garment>' open a list;
// inside a list 'spot:<id>' | 'pocket:<garment>/<pocket>' | 'door:<room>' act; 'back' returns to the first question.
//
// The lead is, in time order: what the last action did, the text of the move it ended in (that screen only),
// and the lines that explain the event (why you look, why you hurry, the plan).

import { describeLocation, describeRoom } from './room-view.js';
import { RefusedMove, choiceNotOffered } from './errors.js';
import { named } from './names.js';

const HINT_MARK = '★';

const markOf = (hint) => (hint === 'hidden' ? undefined : HINT_MARK);
const withMark = (choice, hint) => (markOf(hint) ? { ...choice, mark: markOf(hint) } : choice);

/** The texts that differ between putting a thing away and looking for it. */
const askingFor = (texts) => ({
  putAway: {
    command: texts.putCommand, spots: texts.spotsPutAway, pockets: texts.whichPocketPutAway, hereOption: texts.putInRoom, pocketOption: texts.putInPocket,
  },
  find: {
    command: texts.findCommand, spots: texts.spotsFinding, pockets: texts.whichPocketFinding, hereOption: texts.lookHere, pocketOption: texts.lookInPocket,
  },
});

export class PlayFlow {
  /**
   * @param {import('./day.js').Day} day
   * @param {{ texts: object, onFinished?: () => void, onFound?: (record: object) => void, onPut?: (record: object) => void }} options
   *   `onFinished` is called once, when the last event is done; `onFound` and `onPut` get what each finished find
   *   or put-away cost, before `onFinished`
   */
  constructor(day, { texts, onFinished = () => {}, onFound = () => {}, onPut = () => {} }) {
    this.day = day;
    this.texts = texts;
    this.onFinished = onFinished;
    this.onFound = onFound;
    this.onPut = onPut;
    this.back = { id: 'back', label: texts.back };
    this.menu = { type: 'root' };
    this.selected = null;
    this.lead = [];
    this.arrival = day.state().arrival; // a day restored right after a move shows its text again
    this.reported = false;
  }

  isFinished() {
    return this.day.state().finished;
  }

  step() {
    const state = this.day.state();
    if (state.finished) return { lead: this.lead, command: '', choices: [], selected: null, canLeave: true };
    const view = describeRoom(this.day, this.texts);
    const { command, choices } = state.event.kind === 'pause' ? this.pause(state) : this.question(state, view);
    return { lead: [...this.lead, ...this.arrivalLines(state), ...this.contextLines(state, view)], command, choices, selected: this.selected, canLeave: true };
  }

  pause(state) {
    return { command: this.texts.pauses[state.event.text]({ number: state.number }), choices: [] };
  }

  arrivalLines(state) {
    const { arrival, texts } = this;
    if (!arrival) return [];
    if (arrival.text === 'after') return [texts.uses[arrival.thingId][arrival.useId].after];
    const line = texts.arrivals[arrival.text];
    return [typeof line === 'function' ? line({ room: named(texts.rooms, this.day.roomOf(state.roomId)) }) : line];
  }

  contextLines({ event }, view) {
    const { texts } = this;
    if (event.kind === 'find') return event.useId ? [texts.uses[event.thingId][event.useId].need] : [];
    if (event.kind !== 'putAway') return [];
    const hurry = event.hurry ? [texts.hurryLine({ reason: texts.hurryReasons[event.hurry] })] : [];
    return view.hintText ? [...hurry, view.hintText] : hurry;
  }

  question({ event }, view) {
    const { texts } = this;
    const asking = askingFor(texts)[event.kind];
    switch (this.menu.type) {
      case 'spots':
        return { command: asking.spots({ room: view.room }), choices: this.spotChoices(view) };
      case 'pockets':
        return { command: asking.pockets, choices: this.pocketChoices(view) };
      case 'doors':
        return { command: texts.walkWhere, choices: [...view.rooms.map((room) => withMark({ id: `door:${room.id}`, label: texts.walkOption({ room, steps: room.steps }) }, room.hint)), this.back] };
      case 'hang': {
        const garment = named(texts.garments, this.day.garmentOf(this.menu.garmentId));
        return { command: texts.hangWhere({ garment }), choices: this.spotChoices(view) };
      }
      default:
        return { command: asking.command({ room: view.room, thing: this.thingOf(event.thingId) }), choices: this.rootChoices(event, view) };
    }
  }

  thingOf(thingId) {
    return named(this.texts.things, this.day.things.find((candidate) => candidate.id === thingId));
  }

  rootChoices(event, view) {
    const { texts } = this;
    const asking = askingFor(texts)[event.kind];
    const choices = [{ id: 'spots', label: asking.hereOption({ room: view.room }) }];
    if (this.reachablePockets(view).length > 0) choices.push({ id: 'pockets', label: asking.pocketOption });
    choices.push({ id: 'doors', label: texts.walkToRoom });
    for (const garment of view.worn) if (garment.canTakeOff) choices.push({ id: `hang:${garment.id}`, label: texts.takeOff({ garment }) });
    if (event.kind === 'putAway') for (const garment of view.hanging) choices.push({ id: `puton:${garment.id}`, label: texts.putOn({ garment }) });
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
    const event = this.day.state().event;
    if (!event) return;
    if (event.kind === 'pause') {
      this.perform(() => this.day.continue());
      return;
    }
    const choice = this.selected;
    if (!choice) return;
    this.selected = null;
    this.apply(choice);
  }

  apply(choice) {
    this.lead = [];
    this.arrival = null;
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
    const { menu } = this;
    this.menu = { type: 'root' };
    this.perform(() => this.run(kind, rest, menu));
  }

  /** Runs an action of the day; a refused move is told in the player's language, a mistake in the code is not hidden. */
  perform(action) {
    this.lead = [];
    try {
      this.lead = action() ?? [];
    } catch (error) {
      if (!(error instanceof RefusedMove)) throw error;
      this.lead = [this.texts.refusals[error.code]];
    }
    const state = this.day.state();
    this.arrival = state.arrival;
    if (state.finished && !this.reported) {
      this.reported = true;
      this.onFinished();
    }
  }

  run(kind, rest, menu) {
    const { texts, day } = this;
    if (kind === 'puton') {
      day.putOn(rest);
      return [texts.putOnDone({ garment: named(texts.garments, day.garmentOf(rest)) })];
    }
    if (kind === 'door') {
      day.walkTo(rest);
      return [];
    }
    if (menu.type === 'hang') {
      day.takeOff(menu.garmentId, rest);
      const spot = named(texts.spots, day.roomOf(day.state().roomId).spots.find((candidate) => candidate.id === rest));
      return [texts.hungDone({ garment: named(texts.garments, day.garmentOf(menu.garmentId)), spot })];
    }
    const [first, second] = rest.split('/');
    if (day.state().event.kind === 'putAway') {
      const placed = kind === 'pocket' ? day.putInPocket(first, second) : day.putDown(first);
      const { thingId, steps, atHome, hurry } = placed;
      this.onPut({ thingId, steps, atHome, hurry });
      return [this.placedText(placed)];
    }
    const thingId = day.state().event.thingId;
    const looked = kind === 'pocket' ? day.lookInPocket(first, second) : day.look(first);
    const { found, steps, shortest, wasHome } = looked;
    if (found) this.onFound({ thingId, steps, shortest, wasHome });
    return [this.lookedText(thingId, looked)];
  }

  placedText({ thingId, location, atHome }) {
    const thing = this.thingOf(thingId);
    if (atHome) return this.texts.placedHome({ thing });
    return this.texts.placedAway({
      thing,
      where: describeLocation(this.day, location, this.texts, { withRoom: false }),
      home: describeLocation(this.day, this.day.plan[thingId], this.texts),
    });
  }

  lookedText(thingId, { found, steps, location, seen }) {
    if (found) return this.texts.found({ thing: this.thingOf(thingId), where: describeLocation(this.day, location, this.texts, { withRoom: false }), steps });
    const icons = seen.map((id) => this.day.things.find((candidate) => candidate.id === id).icon);
    return icons.length > 0 ? this.texts.notHereSee({ seen: icons }) : this.texts.notHere;
  }
}
