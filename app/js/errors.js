// Errors for mistakes in the code and for moves the game refuses. Nothing here is shown to a player: a refused
// move carries a code, and the flow looks up the sentence for that code in the texts.

/** Developer messages of the moves the game refuses, by code. The player's sentences live in the texts. */
export const REFUSALS = {
  'no-door': 'Refused: there is no door to that room',
  'not-removable': 'Refused: that garment cannot be taken off',
  'not-worn': 'Refused: you are not wearing that garment',
  'spot-not-here': 'Refused: that spot is not in this room',
  'garment-not-here': 'Refused: that garment is not in this room',
  'out-of-reach': 'Refused: that pocket is out of reach',
};

/** A move the rules do not allow. The player is told with `texts.refusals[code]`. */
export class RefusedMove extends Error {
  constructor(code) {
    super(REFUSALS[code]);
    this.code = code;
  }
}

export const choiceNotOffered = (choiceId) => new Error(`Choice not offered: ${choiceId}`);
export const unknownLocation = (key) => new Error(`Unknown spot or pocket: ${key}`);
