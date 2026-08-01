import { describe, expect, it } from 'vitest';
import { pluralRu } from './format';

const SCORE: [string, string, string] = ['балл', 'балла', 'баллов'];

describe('pluralRu', () => {
  it.each([
    [1, 'балл'],
    [2, 'балла'],
    [4, 'балла'],
    [5, 'баллов'],
    [11, 'баллов'],
    [21, 'балл'],
    [22, 'балла'],
    [25, 'баллов'],
    [111, 'баллов'],
    [0, 'баллов'],
  ])('picks the right form for %i', (n, expected) => {
    expect(pluralRu(n, SCORE)).toBe(expected);
  });

  // Дробные всегда берут родительный единственного, независимо от последней цифры.
  it.each([0.5, 1.5, 2.5, 5.5, 1.3, 11.5])('uses the genitive singular for %f', (n) => {
    expect(pluralRu(n, SCORE)).toBe('балла');
  });
});
