import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgramCursor } from '../preview/program-cursor.js';

test('turn selection and waits allow separated actions without changing earlier slots', () => {
  const cursor = createProgramCursor();
  const program = Array.from({length: 4}, () => ({cards: []}));
  assert.equal(cursor.sync('0/1', [1,2,3,4]), 1);
  program[cursor.turn - 1].cards.push('shot');
  cursor.advance();
  cursor.advance(); // W: wait at 2
  cursor.advance(); // W: wait at 3
  assert.equal(cursor.turn, 4);
  program[cursor.turn - 1].cards.push('shot');
  cursor.advance();
  assert.equal(cursor.turn, null);
  assert.equal(cursor.sync('0/1', [1,2,3,4]), null, 'refresh does not wrap to turn 1');
  assert.deepEqual(program.map(s => s.cards), [['shot'], [], [], ['shot']]);
  assert.equal(cursor.eraseTurn(program), 4);
  cursor.select(1);
  assert.equal(cursor.eraseTurn(program), 1, 'clicking a filled turn selects it for replacement/clearing');
});

test('cursor respects editable phases, crew switches and tutorial reset', () => {
  const cursor = createProgramCursor();
  assert.equal(cursor.sync('0/1', [2,3]), 2, 'first-shot turn 1 is unavailable');
  cursor.select(3);
  cursor.select(1);
  assert.equal(cursor.turn, 3);
  assert.equal(cursor.sync('2/1', [1,2,3]), 1);
  assert.equal(cursor.sync('0/1', [2,3]), 3);
  assert.equal(cursor.sync('0/2', [4,5,6,7]), 4);
  cursor.select(6);
  assert.equal(cursor.eraseTurn(Array.from({length: 7}, () => ({cards: []}))), 5);
  cursor.reset();
  assert.equal(cursor.sync('0/1', [2,3]), 2);
});
