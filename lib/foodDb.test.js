import { describe, it, expect } from 'vitest';
import { isRelevantMatch, tokenize } from './foodDb.js';

// Regression test for a real bad log: a photo of potato salad came back
// north of 1000 calories because the old code took USDA's first
// Foundation/SR Legacy hit for "potato salad" with no relevance check —
// which is "Flour, potato" (361 kcal/100g), not an actual potato salad.
describe('isRelevantMatch', () => {
  it('rejects a same-ingredient-but-wrong-dish match (potato salad vs. potato flour)', () => {
    const q = tokenize('potato salad');
    expect(isRelevantMatch(q, 'Flour, potato')).toBe(false);
  });

  it('rejects a match missing the dish\'s defining word entirely', () => {
    const q = tokenize('potato salad');
    expect(isRelevantMatch(q, 'Salad dressing, Italian dressing, commercial, regular')).toBe(false);
  });

  it('accepts a match containing every core word of the query', () => {
    const q = tokenize('chicken breast');
    expect(isRelevantMatch(q, 'Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBe(true);
  });

  it('rejects a raw-only match when the AI described the food as cooked', () => {
    const q = tokenize('white rice, cooked');
    expect(isRelevantMatch(q, 'Rice, white, long-grain, regular, raw, unenriched')).toBe(false);
  });

  it('accepts a cooked match when the AI described the food as cooked', () => {
    const q = tokenize('white rice, cooked');
    expect(isRelevantMatch(q, 'Rice, white, long-grain, regular, cooked, unenriched')).toBe(true);
  });

  it('does not require a specific cooking method to match, only "cooked vs raw"', () => {
    // The AI said "grilled", USDA's closest entry says "roasted" — same
    // state (cooked), different method — this should still be usable.
    const q = tokenize('chicken breast, grilled');
    expect(isRelevantMatch(q, 'Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBe(true);
  });
});
