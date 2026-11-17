// Draws one screen: the app's command, the choices the player can make, and Next (unless one tap makes it
// needless). No game logic here.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A small underlined link at the top of a screen, quiet so that it does not draw the eye from the command. */
function quietLink(text, onClick) {
  const link = el('button', 'menu-link', text);
  link.type = 'button';
  link.addEventListener('click', onClick);
  return link;
}

/**
 * @param {{ lead: string[], command: string, choices: { id: string, label: string, mark?: string }[], selected: string | null,
 *           canLeave?: boolean, canLookBack?: boolean, showNext?: boolean, praise?: string }} step
 * @param {{ onChoose: (id: string) => void, onNext: () => void, onLeave: () => void, onLookBack: () => void }} handlers
 * @param {{ next: string, menu: string, lookBack: string }} texts
 */
export function renderStep(step, { onChoose, onNext, onLeave, onLookBack }, texts) {
  const screen = el('section', 'screen');
  if (step.canLeave) {
    const links = el('div', 'top-links');
    links.append(quietLink(texts.menu, onLeave));
    if (step.canLookBack) links.append(quietLink(texts.lookBack, onLookBack));
    screen.append(links);
  }
  if (step.praise) {
    const praise = el('p', 'praise', step.praise);
    praise.setAttribute('role', 'status');
    screen.append(praise);
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
    option.setAttribute('aria-checked', String(showsSelection(step) && choice.id === step.selected));
    option.dataset.choice = choice.id;
    option.append(el('span', 'choice-label', choice.label));
    if (choice.mark) option.append(el('span', 'choice-mark', choice.mark));
    option.addEventListener('click', () => onChoose(choice.id));
    choices.append(option);
  }
  screen.append(choices);

  if (step.showNext !== false) {
    const next = el('button', 'primary next', texts.next);
    next.type = 'button';
    next.disabled = nextIsDisabled(step);
    next.addEventListener('click', onNext);
    screen.append(next);
  }
  return screen;
}

/** Without a Next button a tap acts at once, so a preselected choice ("Go on") would only look like a choice already made. */
const showsSelection = (step) => step.showNext !== false;

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
  const next = screen.querySelector('.next');
  if (next) next.disabled = nextIsDisabled(step);
}
