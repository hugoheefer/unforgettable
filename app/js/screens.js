// Draws one screen: the app's command, the choices the player can make, and Next. No game logic here.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {{ lead: string[], command: string, choices: { id: string, label: string, mark?: string }[], selected: string | null }} step
 * @param {{ onChoose: (id: string) => void, onNext: () => void }} handlers
 * @param {{ next: string }} texts
 */
export function renderStep(step, { onChoose, onNext }, texts) {
  const screen = el('section', 'screen');
  if (step.lead.length > 0) {
    const lead = el('div', 'lead');
    for (const line of step.lead) lead.append(el('p', '', line));
    screen.append(lead);
  }
  screen.append(el('h1', 'command', step.command));

  const choices = el('div', 'choices');
  choices.setAttribute('role', 'radiogroup');
  for (const choice of step.choices) {
    const option = el('button', 'choice');
    option.type = 'button';
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', String(choice.id === step.selected));
    option.dataset.choice = choice.id;
    option.append(el('span', 'choice-label', choice.label));
    if (choice.mark) option.append(el('span', 'choice-mark', choice.mark));
    option.addEventListener('click', () => onChoose(choice.id));
    choices.append(option);
  }
  screen.append(choices);

  const next = el('button', 'primary next', texts.next);
  next.type = 'button';
  next.disabled = step.choices.length > 0 && step.selected === null;
  next.addEventListener('click', onNext);
  screen.append(next);
  return screen;
}
