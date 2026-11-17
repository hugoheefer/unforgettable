// The contract every chain of the game is held to, as a function that lists what is wrong with a chain. Called
// for every chain of the list, so a new chain is checked the moment it is added. Test code, not production code:
// chains.test.mjs also checks that this function notices each kind of fault.

const isText = (value) => (typeof value === 'string' && value.length > 0) || typeof value === 'function';

/**
 * @param {object} chain
 * @param {{ rooms: Set<string>, catalogueIds: Set<string>, hasLocation: Function, kinds: object, sentences: object }} context
 *   `sentences` is the `chains` table of one language
 * @returns {string[]} what is wrong; empty when the chain keeps the contract
 */
export function problemsOf(chain, { rooms, catalogueIds, hasLocation, kinds, sentences }) {
  const problems = [];
  if (typeof chain.id !== 'string' || chain.id.length === 0) problems.push('the chain has no id');
  if (!Array.isArray(chain.steps) || chain.steps.length === 0) return [...problems, 'the chain has no steps'];

  const ids = chain.steps.map((step) => step.id);
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) problems.push('a step has no id');
  if (new Set(ids).size !== ids.length) problems.push('two steps have the same id');

  const context = { rooms, catalogueIds, hasLocation };
  const taken = new Set();
  for (const step of chain.steps) {
    const kind = kinds[step.kind];
    if (!kind) {
      problems.push(`${step.id}: unknown kind ${step.kind}`);
      continue;
    }
    if (!kind.isValid(step, context)) problems.push(`${step.id}: the fields of a ${step.kind} are wrong`);
    if (step.kind === 'take') taken.add(step.object);
    if (step.kind === 'putBack' && !taken.has(step.object)) problems.push(`${step.id}: ${step.object} is put back before it is taken`);
    if (kind.needsSentence(step, context) && !isText(sentences?.[chain.id]?.[step.id])) problems.push(`${step.id}: no sentence`);
  }

  const first = kinds[chain.steps[0].kind];
  if (first && !first.leavesRoom) problems.push('the chain does not start by putting you in a room');

  const known = new Set(ids);
  for (const key of Object.keys(sentences?.[chain.id] ?? {})) if (!known.has(key)) problems.push(`${key}: a sentence without a step`);

  if (chain.opener === true) {
    for (const id of chain.needsOnPerson ?? []) if (!catalogueIds.has(id)) problems.push(`${id}: needed on the person but not in the catalogue`);
  }
  return problems;
}
