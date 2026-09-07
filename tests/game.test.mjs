import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/levels.js';
import { freshState, sanitizeState, discover, canVisit, completeLevel, offlineReply } from '../dist/engine.js';

test('all five chapters: clues required, incorrect answers rejected, unlock exactly next chapter, replay does not duplicate rewards', () => {
  const s = freshState();
  for (let i = 0; i < 5; i++) {
    assert.equal(canVisit(s, i), true); assert.equal(canVisit(s, i + 1), false); s.current = i;
    assert.equal(completeLevel(s, LEVELS[i].puzzle.answer), false);
    for (let clue = 0; clue < 3; clue++) { assert.equal(discover(s, clue), true); assert.equal(discover(s, clue), false); }
    assert.equal(completeLevel(s, [9, 9, 9]), false);
    assert.equal(completeLevel(s, LEVELS[i].puzzle.answer), true);
    assert.equal(completeLevel(s, LEVELS[i].puzzle.answer), true);
    assert.equal(s.completed.length, i + 1);
  }
  assert.equal(s.completed.length, 5); assert.equal(canVisit(s, 5), false);
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(s))), s);
});

test('save recovery clamps corrupt chapter, rejects invalid clues/history and noncontiguous completion', () => {
  const s = sanitizeState({ version: 1, current: 999, completed: [0, 2, 4], clues: [[0, 0, -1, 9, '1']], chats: [[{ role: 'system', content: 'attack' }, { role: 'assistant', content: '<script>bad</script>' }]], friendships: [0, 0, 9] });
  assert.deepEqual(s.completed, [0]); assert.equal(s.current, 1); assert.deepEqual(s.clues[0], [0]); assert.equal(s.chats[0].length, 1); assert.deepEqual(s.friendships, [0]);
  assert.deepEqual(sanitizeState(null), freshState()); assert.deepEqual(sanitizeState({ version: 9 }), freshState());
});

test('offline dialogue is explicit and hints reflect current progress without unlocking anything', () => {
  const s = freshState(); assert.match(offlineReply(s, '提示'), /0\/3/); [0, 1, 2].forEach(i => discover(s, i));
  assert.match(offlineReply(s, '提示'), /海藍/); assert.match(offlineReply(s, 'quantum turtles'), /預寫的離線劇情/); assert.deepEqual(s.completed, []);
});

test('every sequence can be solved and every postcard tile reaches upright by clockwise rotation', () => {
  for (const l of LEVELS) if (l.puzzle.kind === 'sequence') for (const index of l.puzzle.answer) assert.ok(l.puzzle.options[index]);
  const rotations = LEVELS[4].puzzle.initial.map(v => (v + (4 - v)) % 4); assert.deepEqual(rotations, LEVELS[4].puzzle.answer);
});
