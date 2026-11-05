import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialPhaseReady, tutorialPhaseButton } from '../preview/tutorial-program.js';
import { loadLocale } from '../preview/i18n.js';
import { basicsView } from '../preview/basics.js';

function fixture(id) {
  return { stage: 'programming', phase: 1, tutorial: { id }, game: {
    programs: Array.from({ length: 4 }, () => Array.from({ length: 7 }, () => ({ cards: [] }))), cards: {},
  } };
}
function place(state, crew, turn, ...actions) {
  const id = `${crew}/${turn}`;
  state.game.cards[id] = { sides: [actions] };
  state.game.programs[crew][turn - 1].cards = [{ id, side: 0 }];
}

test('energy readiness includes both crew objectives but not empty wait turns or next phase', () => {
  const s = fixture('energy');
  for (const turn of [1, 2, 3]) place(s, 0, turn, 'A');
  assert.equal(tutorialPhaseReady(s), false);
  place(s, 2, 1, 'lift');
  place(s, 2, 2, 'A');
  assert.equal(tutorialPhaseReady(s), false, 'wrong refill action');
  place(s, 2, 2, 'B');
  assert.equal(tutorialPhaseReady(s), true, 'crew 3 turn 3 and turn 4 intentionally empty');
  s.game.programs[2][0].cards = [];
  assert.equal(tutorialPhaseReady(s), false, 'clearing a required action removes cue');
  place(s, 2, 1, 'lift');
  s.phase = 2;
  assert.equal(tutorialPhaseReady(s), false);
  s.phase = 1;
  s.stage = 'resolution';
  assert.equal(tutorialPhaseReady(s), false);
});

test('phase cues follow the requested actions for each exercise', () => {
  for (const [id, turns] of [
    ['repairs', [['blue'], ['B'], ['B']]],
    ['battlebots', [['blue'], ['C'], ['red']]],
    ['double-actions', [['blue', 'A']]],
    ['phasing', [['A'], ['A'], ['A']]],
    ['specializations', [['special:rocketeer:basic']]],
  ]) {
    const s = fixture(id);
    assert.equal(tutorialPhaseReady(s), false, id);
    turns.forEach((actions, i) => place(s, 0, i + 1, ...actions));
    assert.equal(tutorialPhaseReady(s), true, id);
  }
  assert.equal(tutorialPhaseReady(fixture('unknown')), false);
});

test('lock labels are visible in EN/FR; readiness is advisory and busy still disables', async () => {
  for (const [locale, label] of [['en', 'Lock phase 1'], ['fr', 'Verrouiller la phase 1']]) {
    await loadLocale(locale);
    const s = fixture('specializations');
    const initial = tutorialPhaseButton(s, locale);
    assert.ok(initial.includes(`<span>${label}</span>`));
    assert.ok(!initial.includes('disabled'));
    assert.ok(!initial.includes('role="status"'));
    place(s, 0, 1, 'special:rocketeer:basic');
    const ready = tutorialPhaseButton(s, locale, true);
    assert.match(ready, /lesson-phase-lock ready/);
    assert.match(ready, /role="status"/);
    assert.match(ready, /disabled/);
  }
});

test('native first lesson retains a visible localized execution label and enablement', async () => {
  for (const [locale, label] of [['en', 'Run program'], ['fr', 'Exécuter le programme']]) {
    await loadLocale(locale);
    const s = fixture('basics');
    s.mission = { phaseEndsMs: [600000] };
    s.missionStartAt = 0;
    s.observedAt = 0;
    s.tutorial.nativeStep = 1;
    const html = basicsView(s, locale, {});
    assert.ok(html.includes(`<span>${label}</span>`));
    assert.match(html, /id="basics-run"[^>]*disabled/);
    place(s, 0, 1, 'blue');
    place(s, 0, 2, 'lift');
    assert.doesNotMatch(basicsView(s, locale, {}), /id="basics-run"[^>]*disabled/);
  }
});
