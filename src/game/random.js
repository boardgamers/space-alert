// Serializable deterministic PRNG. The host keeps the seed and undrawn decks secret.
export function random(seed) {
  let value = 2166136261;
  for (const ch of String(seed))
    value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(values, rng) {
  const result = structuredClone(values);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
