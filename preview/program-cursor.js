// Local insertion positions are independent for each crew member and phase.
// null means the cursor has reached the end; undefined means a new phase.
export function createProgramCursor() {
  const positions = new Map();
  let scope, turns = [];
  return {
    sync(nextScope, editable) {
      scope = nextScope;
      turns = editable;
      const current = positions.get(scope);
      if (current === undefined || (current !== null && !turns.includes(current)))
        positions.set(scope, turns[0] ?? null);
      return this.turn;
    },
    get turn() { return positions.get(scope) ?? null; },
    select(turn) {
      if (turns.includes(turn)) positions.set(scope, turn);
    },
    advance(turn = this.turn) {
      positions.set(scope, turns.find(n => n > turn) ?? null);
    },
    eraseTurn(program) {
      if (this.turn !== null && program[this.turn - 1]?.cards.length) return this.turn;
      return turns.filter(n => this.turn === null || n < this.turn).at(-1) ?? null;
    },
    reset() { positions.clear(); },
  };
}
