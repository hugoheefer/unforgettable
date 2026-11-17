// Draws one screen: the app's command, the choices the player can make, and Next. No game logic here.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {{ lead: string[], command: string, choices: { id: string, label: string, mark?: string }[], selected: string | null, canLeave?: boolean }} step
 * @param {{ onChoose: (id: string) => void, onNext: () => void, onLeave: () => void }} handlers
 * @param {{ next: string, menu: string }} texts
 */
export function renderStep(step, { onChoose, onNext, onLeave }, texts) {
  const screen = el('section', 'screen');
  if (step.canLeave) {
    const menu = el('button', 'menu-link', texts.menu);
    menu.type = 'button';
    menu.addEventListener('click', onLeave);
    screen.append(menu);
  }
  if (step.lead.length > 0) {
    const lead = el('div', 'lead');
    for (const line of step.lead) lead.append(el('p', '', line));
    screen.append(lead);
  }
  const command = el('h1', 'command', step.command);
  command.tabIndex = -1; // focus target after a screen change; see main.js
  screen.append(command);

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
  next.disabled = nextIsDisabled(step);
  next.addEventListener('click', onNext);
  screen.append(next);
  return screen;
}

const nextIsDisabled = (step) => step.choices.length > 0 && step.selected === null;

/**
 * Shows a new selection on a screen that is already drawn, without rebuilding it. A rebuild while the page is
 * scrolled lets the browser keep an offset that the shorter next screen cannot honour.
 * @param {HTMLElement} screen the element `renderStep` returned
 * @param {{ choices: { id: string }[], selected: string | null }} step
 */
export function updateSelection(screen, step) {
  for (const option of screen.querySelectorAll('[data-choice]')) {
    option.setAttribute('aria-checked', String(option.dataset.choice === step.selected));
  }
  screen.querySelector('.next').disabled = nextIsDisabled(step);
}
