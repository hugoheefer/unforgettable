// The contract every chain of the game is held to, as a function that lists what is wrong with a chain. Called
// for every chain of the list, so a new chain is checked the moment it is added. Test code, not production code:
// chains.test.mjs also checks that this function notices each kind of fault.

const isText = (value) => (typeof value === 'string' && value.length > 0) || typeof value === 'function';

/**
 * Every way through a chain: one list of steps per combination of options. A choose stays in the list, followed by
 * the steps of the option taken, so the rules that look at the order of steps hold on every path.
 */
export function pathsOf(chain) {
  let paths = [[]];
  for (const step of chain.steps) {
    const options = step.kind === 'choose' && Array.isArray(step.options) ? step.options : null;
    paths = options === null
      ? paths.map((path) => [...path, step])
      : options.flatMap((option) => paths.map((path) => [...path, step, ...(Array.isArray(option.steps) ? option.steps : [])]));
  }
  return paths;
}

/** Every step of a chain once, the steps inside options included. */
const allStepsOf = (chain) => chain.steps.flatMap((step) => [step, ...(step.kind === 'choose' && Array.isArray(step.options) ? step.options.flatMap((option) => option.steps ?? []) : [])]);

/**
 * @param {object} chain
 * @param {{ rooms: Set<string>, catalogueIds: Set<string>, hasLocation: Function, kinds: object, sentences: object, labels?: object }} context
 *   `sentences` is the `chains` table of one language, `labels` its `options` table
 * @returns {string[]} what is wrong; empty when the chain keeps the contract on every path
 */
export function problemsOf(chain, { rooms, catalogueIds, hasLocation, kinds, sentences, labels }) {
  const problems = new Set();
  const report = (problem) => problems.add(problem);
  if (typeof chain.id !== 'string' || chain.id.length === 0) report('the chain has no id');
  if (!Array.isArray(chain.steps) || chain.steps.length === 0) return [...problems, 'the chain has no steps'];

  if (!['morning', 'day', 'evening'].includes(chain.time)) report('the chain has no time of day');
  if (chain.closer === true && chain.time !== 'evening') report('the closing chain is played in the evening');

  const ids = allStepsOf(chain).map((step) => step.id);
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) report('a step has no id');
  if (new Set(ids).size !== ids.length) report('two steps have the same id');

  const context = { rooms, catalogueIds, hasLocation };
  for (const path of pathsOf(chain)) {
    const taken = new Set();
    for (const step of path) {
      const kind = kinds[step.kind];
      if (!kind) {
        report(`${step.id}: unknown kind ${step.kind}`);
        continue;
      }
      if (!kind.isValid(step, context)) report(`${step.id}: the fields of a ${step.kind} are wrong`);
      if (step.kind === 'choose') chooseProblems(chain, step, labels).forEach(report);
      if (step.kind === 'check' && chain.closer !== true) report(`${step.id}: a check belongs to the closing chain only`);
      if (step.kind === 'needAgain' && chain.closer !== true) report(`${step.id}: needAgain belongs to the closing chain only`);
      if (chain.closer === true && (step.kind === 'take' || step.kind === 'putBack')) report(`${step.id}: the closing chain takes and puts back nothing`);
      if (step.uses !== undefined && !taken.has(step.uses)) report(`${step.id}: uses ${step.uses}, which the chain does not take earlier`);
      if (step.kind === 'take') taken.add(step.object);
      if (step.kind === 'putBack' && !taken.has(step.object)) report(`${step.id}: ${step.object} is put back before it is taken`);
      if (kind.needsSentence(step, context) && !isText(sentences?.[chain.id]?.[step.id])) report(`${step.id}: no sentence`);
    }
  }

  // only the opener sets the scene of a session; every other story starts where the player is
  if (chain.opener !== true && chain.steps[0].kind === 'move') report('the chain starts with a move, but only an opener may');

  const known = new Set(ids);
  for (const key of Object.keys(sentences?.[chain.id] ?? {})) if (!known.has(key)) report(`${key}: a sentence without a step`);

  if (chain.opener === true) {
    for (const id of chain.needsOnPerson ?? []) if (!catalogueIds.has(id)) report(`${id}: needed on the person but not in the catalogue`);
  }
  return [...problems];
}

/** The rules of a choose that are not about its fields: two or three options, each with its own id and its own label. */
function chooseProblems(chain, step, labels) {
  const options = Array.isArray(step.options) ? step.options : [];
  const problems = [];
  if (options.length < 2 || options.length > 3) problems.push(`${step.id}: a choose has two or three options`);
  if (new Set(options.map((option) => option.id)).size !== options.length) problems.push(`${step.id}: two options have the same id`);
  for (const option of options) if (!isText(labels?.[chain.id]?.[step.id]?.[option.id])) problems.push(`${step.id}/${option.id}: no label`);
  return problems;
}
