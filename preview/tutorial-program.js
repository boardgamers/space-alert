import { translate } from './i18n.js';
import { pictogram } from './icons.js';

// A teaching cue, not a rule or a prediction of successful resolution. Check
// only the actions requested in this phase, never every slot: empty turns wait.
export function tutorialPhaseReady(state) {
  if (state.stage !== 'programming' || state.phase !== 1) return false;
  const actions = (crew, turn) => (state.game.programs[crew]?.[turn - 1]?.cards ?? [])
    .flatMap(card => state.game.cards[card.id]?.sides[card.side] ?? []);
  const has = (crew, turn, action) => actions(crew, turn).includes(action);
  switch (state.tutorial?.id) {
    case 'energy':
      return [1, 2, 3].every(turn => has(0, turn, 'A')) &&
        has(2, 1, 'lift') && has(2, 2, 'B');
    case 'repairs':
      return has(0, 1, 'blue') && [2, 3].every(turn => has(0, turn, 'B'));
    case 'battlebots':
      return has(0, 1, 'blue') && has(0, 2, 'C') && has(0, 3, 'red');
    case 'double-actions':
      return [1, 2, 3].some(turn => {
        const programmed = actions(0, turn);
        return programmed.length === 2 && programmed.includes('blue') && programmed.includes('A');
      });
    case 'phasing':
      return [1, 2, 3].every(turn => has(0, turn, 'A'));
    case 'specializations':
      return has(0, 1, 'special:rocketeer:basic');
    default:
      return false;
  }
}

export function tutorialPhaseButton(state, locale, busy = false) {
  const ready = tutorialPhaseReady(state);
  const label = translate(locale, 'tutorial.lock_phase', { phase: state.phase });
  return `<button data-guide="phase" class="icon-label lesson-phase-lock${ready ? ' ready' : ''}" ${busy ? 'disabled' : ''}>${pictogram('lock')}<span>${label}</span></button>${ready ? `<span class="lesson-phase-ready" role="status">${translate(locale, 'tutorial.phase_ready')}</span>` : ''}`;
}
