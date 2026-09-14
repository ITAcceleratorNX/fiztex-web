import { describe, expect, it } from 'vitest';
import type { BindingOptionsYear, TextbookBinding } from '@/lib/textbooksApi';
import {
  WHOLE_YEAR,
  bindingRowState,
  buildBindingsRequest,
  classOptions,
  describeBatch,
  pagesLabel,
  parsePageRange,
  subjectOptions,
  textbookFileProblem,
  titleFromFileName,
  toHex,
} from './textbookModel';

const TODAY = '2026-09-14';

function binding(overrides: Partial<TextbookBinding>): TextbookBinding {
  return { id: 1, effectiveFrom: '2026-09-01', effectiveTo: undefined, active: true, ...overrides };
}

const YEAR: BindingOptionsYear = {
  id: 1,
  name: '2026–2027',
  current: true,
  periods: [],
  assignments: [
    { subjectId: 10, subjectName: 'Английский язык', classId: 5, className: '5А', subgroups: [] },
    { subjectId: 10, subjectName: 'Английский язык', classId: 6, className: '6В', subgroups: [] },
    { subjectId: 20, subjectName: 'Физика', classId: 6, className: '6В', subgroups: [] },
  ],
};

describe('bindingRowState', () => {
  it('действующее без окончания можно завершить', () => {
    expect(bindingRowState(binding({}), TODAY)).toEqual({ kind: 'active' });
  });

  it('завершённое сегодня ещё действует, но кнопки завершения у него нет', () => {
    expect(bindingRowState(binding({ effectiveTo: TODAY }), TODAY)).toEqual({ kind: 'ending', until: TODAY });
  });

  it('не начавшееся отличается от закончившегося датой начала, а не флагом', () => {
    expect(bindingRowState(binding({ active: false, effectiveFrom: '2026-11-10' }), TODAY)).toEqual({
      kind: 'upcoming',
      from: '2026-11-10',
    });
    expect(
      bindingRowState(binding({ active: false, effectiveFrom: '2026-09-01', effectiveTo: '2026-09-10' }), TODAY),
    ).toEqual({ kind: 'ended', on: '2026-09-10' });
  });
});

describe('варианты формы назначения', () => {
  it('предмет предлагается, только если учитель ведёт его во всех выбранных классах', () => {
    expect(subjectOptions(YEAR, []).map((o) => o.label)).toEqual(['Английский язык', 'Физика']);
    expect(subjectOptions(YEAR, [5, 6]).map((o) => o.label)).toEqual(['Английский язык']);
    expect(subjectOptions(YEAR, [6]).map((o) => o.label)).toEqual(['Английский язык', 'Физика']);
  });

  it('классы сужаются выбранным предметом', () => {
    expect(classOptions(YEAR, null).map((o) => o.label)).toEqual(['5А', '6В']);
    expect(classOptions(YEAR, 20).map((o) => o.label)).toEqual(['6В']);
  });

  it('«весь год» уходит пустым списком периодов, класс — без подгруппы', () => {
    expect(buildBindingsRequest({ textbookId: 3, academicYearId: 1, period: '7', classIds: [5, 6] })).toEqual({
      textbookId: 3,
      academicYearId: 1,
      academicPeriodIds: [7],
      targets: [{ classId: 5 }, { classId: 6 }],
    });
    expect(
      buildBindingsRequest({ textbookId: 3, academicYearId: 1, period: WHOLE_YEAR, classIds: [5] }).academicPeriodIds,
    ).toEqual([]);
  });

  it('о пропущенных клетках говорит, а не молчит', () => {
    expect(describeBatch({ created: [{}, {}], skipped: [{ reason: 'ALREADY_BOUND' }] })).toEqual({
      tone: 'success',
      text: 'Учебник назначен: 2 назначения, уже было назначено — 1',
    });
    expect(describeBatch({ created: [], skipped: [{ reason: 'PERIOD_ENDED' }] }).tone).toBe('info');
  });
});

describe('страницы', () => {
  it('подпись: одна страница, диапазон или ничего', () => {
    expect(pagesLabel(24, 26)).toBe('стр. 24–26');
    expect(pagesLabel(24, null)).toBe('стр. 24');
    expect(pagesLabel(24, 24)).toBe('стр. 24');
    expect(pagesLabel(null, null)).toBe('');
  });

  it('пустые поля — «с первой страницы», конец без начала не принимается', () => {
    expect(parsePageRange('', '', 142)).toEqual({ range: { pageFrom: null, pageTo: null } });
    expect(parsePageRange('24', '', 142)).toEqual({ range: { pageFrom: 24, pageTo: null } });
    expect(parsePageRange('', '26', 142)).toEqual({ error: 'Укажите, с какой страницы' });
  });

  it('границы учебника и порядок диапазона', () => {
    expect(parsePageRange('140', '150', 142)).toEqual({ error: 'В учебнике 142 страницы' });
    expect(parsePageRange('26', '24', 142)).toEqual({ error: 'Конец диапазона раньше начала' });
    expect(parsePageRange('0', '', 142)).toEqual({ error: 'Страницы начинаются с первой' });
    expect(parsePageRange('2а', '', 142)).toEqual({ error: 'Страница — целое число' });
  });
});

describe('файл', () => {
  it('отсекает чужой формат и слишком большой файл до загрузки', () => {
    expect(textbookFileProblem({ name: 'scan.jpg', size: 10 })).toBe('Нужен файл PDF или DOCX');
    expect(textbookFileProblem({ name: 'book.PDF', size: 101 * 1024 * 1024 })).toBe('Файл больше 100 МБ');
    expect(textbookFileProblem({ name: 'book.docx', size: 10 })).toBeNull();
  });

  it('название по умолчанию — имя без расширения', () => {
    expect(titleFromFileName('spotlight6_sb.pdf')).toBe('spotlight6_sb');
  });

  it('хэш в hex с ведущими нулями', () => {
    expect(toHex(new Uint8Array([0, 15, 255]).buffer)).toBe('000fff');
  });
});
