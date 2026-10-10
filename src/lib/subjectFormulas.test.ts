import { describe, expect, it } from 'vitest';
import fixtures from '../test/fixtures/formula-fixtures.json';
import { renderFormula } from './katexRender';
import { checkFormulas, hasBlockingProblem } from './formulaChecks';
import { hasForbiddenCommand, splitMath } from './mathMarkup';

describe('предметные формулы в вебе', () => {
  it.each(fixtures)('$id: разметка, отображение и готовность', (fixture) => {
    for (const display of [false, true]) {
      const delimiter = display ? '$$' : '$';
      const text = delimiter + fixture.latex + delimiter;
      expect(splitMath(text)).toEqual([{ kind: 'math', value: fixture.latex, display }]);
      expect(renderFormula(fixture.latex, display).ok).toBe(fixture.renderable);
      expect(hasBlockingProblem(checkFormulas([{ where: 'Вопрос', text }]))).toBe(!fixture.publishable);
    }
  });

  it('не считает многозначный изотоп математической опечаткой', () => {
    expect(checkFormulas([{ where: 'Вопрос', text: String.raw`$\ce{^227_90Th+}$` }])).toEqual([]);
  });

  it('учитывает чётность обратных слешей в чёрном списке', () => {
    expect(hasForbiddenCommand(String.raw`\def\x{1}x`)).toBe(true);
    expect(hasForbiddenCommand(String.raw`\\def`)).toBe(false);
    expect(hasForbiddenCommand(String.raw`\\\def\x{1}x`)).toBe(true);
  });

  it('блокирует превышение согласованных пределов', () => {
    expect(renderFormula('x'.repeat(4097)).ok).toBe(false);
    expect(hasBlockingProblem(checkFormulas([{ where: 'Вопрос', text: '$x$ '.repeat(129) }]))).toBe(true);
  });
});
