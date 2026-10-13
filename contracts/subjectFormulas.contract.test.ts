import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fixtures from '../../fiztex-back/docs/formula-fixtures.json';
import webFixtures from '../src/test/fixtures/formula-fixtures.json';
import { renderFormula } from '../src/lib/katexRender';
import { checkFormulas, hasBlockingProblem } from '../src/lib/formulaChecks';
import { hasForbiddenCommand, splitMath } from '../src/lib/mathMarkup';
// @ts-expect-error The RN module is plain JS; this test exercises the shipped implementation.
import * as mobile from '../../fiztex-mobile/mobile/src/shared/math/mathMarkup.js';

describe('общий предметный набор', () => {
  it('локальный набор веба совпадает с источником контракта', () => {
    expect(webFixtures).toEqual(fixtures);
  });

  it.each(fixtures)('$id: одинаковые разметка, отображение и готовность', (fixture) => {
    for (const display of [false, true]) {
      const delimiter = display ? '$$' : '$';
      const text = delimiter + fixture.latex + delimiter;
      expect(splitMath(text)).toEqual([{kind:'math', value:fixture.latex, display}]);
      expect(mobile.splitMath(text)).toEqual(splitMath(text));
      expect(renderFormula(fixture.latex, display).ok).toBe(fixture.renderable);
      expect(hasBlockingProblem(checkFormulas([{where:'Вопрос',text}]))).toBe(!fixture.publishable);
    }
  });

  it('не считает многозначный изотоп математической опечаткой', () => {
    expect(checkFormulas([{where:'Вопрос',text:String.raw`$\ce{^227_90Th+}$`}])).toEqual([]);
  });

  it('учитывает чётность обратных слешей в чёрном списке', () => {
    for (const value of [String.raw`\def\x{1}x`,String.raw`\\def`,String.raw`\\\def\x{1}x`]) {
      expect(mobile.hasForbiddenCommand(value)).toBe(hasForbiddenCommand(value));
    }
    expect(hasForbiddenCommand(String.raw`\\def`)).toBe(false);
    expect(hasForbiddenCommand(String.raw`\\\def\x{1}x`)).toBe(true);
  });

  it('блокирует превышение согласованных пределов', () => {
    expect(renderFormula('x'.repeat(4097)).ok).toBe(false);
    expect(hasBlockingProblem(checkFormulas([{where:'Вопрос',text:'$x$ '.repeat(129)}]))).toBe(true);
  });
});

describe('автономный мобильный bundle', () => {
  type OfflineWindow = Window & {
    fxRender: (payload: object) => void;
    katex: { renderToString: (latex: string, options: object) => string };
  };
  beforeAll(() => {
    const source = readFileSync(resolve(process.cwd(), '../fiztex-mobile/mobile/src/shared/math/katexAsset.js'), 'utf8');
    const match = source.match(/export const KATEX_HTML = (.*);/);
    if (!match) throw new Error('Missing generated offline asset');
    const html: string = JSON.parse(match[1]);
    document.body.innerHTML = '<div id="root"></div>';
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) window.eval(script[1]);
  });

  it.each(fixtures)('$id: bundle действительно содержит mhchem и те же настройки', (fixture) => {
    for (const display of [false, true]) {
      (window as unknown as OfflineWindow).fxRender({
        segments:[{kind:'math',value:fixture.latex,display,forbidden:mobile.hasForbiddenCommand(fixture.latex)}],
        fontSize:16,lineHeight:1.35,color:'#172033',fallback:fixture.latex,
      });
      const root = document.querySelector('#root')!;
      expect(root.querySelector('.fx-error') !== null).toBe(!fixture.renderable);
      const web = renderFormula(fixture.latex, display);
      if (web.ok) {
        expect(root.querySelector('math')).not.toBeNull();
        // render() builds DOM directly and merges text nodes; renderToString() preserves
        // wrappers. Compare the same API while also exercising the actual WebView bridge.
        expect((window as unknown as OfflineWindow).katex.renderToString(fixture.latex, {
          displayMode:display,throwOnError:true,strict:'ignore',trust:false,maxExpand:1000,maxSize:20,
        })).toBe(web.html);
      } else expect(root.textContent).toContain(fixture.latex);
    }
  });
});
