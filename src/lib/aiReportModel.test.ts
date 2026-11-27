import { describe, expect, it } from 'vitest';
import {
  PARENT_BLOCKS,
  TEACHER_BLOCKS,
  editableBlocks,
  joinBlocks,
  parentBlocks,
  parentStatus,
  periodProblem,
  reportStatus,
  teacherBlocks,
  yearMonths,
  type AiReport,
} from './aiReportModel';

const TEACHER_TEXT = `Результаты и достижения
• Средний балл 7,9 — выше, чем в 1 четверти.
• СОР 2 — 17 из 20.

Рекомендации учителю
• Дать 2–3 задачи на системы уравнений.

Ограничения данных
• Замечания по поведению в системе не фиксируются.`;

describe('текст учителя', () => {
  it('делится на блоки по заголовкам сервера и знает роль блока', () => {
    const blocks = teacherBlocks(TEACHER_TEXT);
    expect(blocks.map((block) => [block.title, block.role, block.items.length])).toEqual([
      ['Результаты и достижения', 'facts', 2],
      ['Рекомендации учителю', 'recommendations', 1],
      ['Ограничения данных', 'limitations', 1],
    ]);
    expect(blocks[0].items[0]).toBe('Средний балл 7,9 — выше, чем в 1 четверти.');
  });

  it('собирается обратно тем же форматом, пустой блок пропадает вместе с заголовком', () => {
    const blocks = editableBlocks(TEACHER_TEXT, TEACHER_BLOCKS);
    expect(blocks.map((block) => block.title)).toEqual([...TEACHER_BLOCKS]);
    expect(joinBlocks(blocks, true)).toBe(TEACHER_TEXT);
  });

  it('свободный текст без заголовков — один блок, а не потерянные строки', () => {
    expect(teacherBlocks('Просто текст учителя\nвторая строка')).toEqual([
      { title: null, role: 'free', items: ['Просто текст учителя', 'вторая строка'] },
    ]);
    expect(editableBlocks('Просто текст', TEACHER_BLOCKS)).toHaveLength(1);
  });

  it('строка, похожая на заголовок внутри пункта, заголовком не становится', () => {
    const blocks = teacherBlocks('Результаты и достижения\n• Рекомендации учителю: повторить тему');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].items[0]).toBe('Рекомендации учителю: повторить тему');
  });
});

describe('текст для родителя', () => {
  it('три блока — абзацами, без маркеров', () => {
    const text = 'Достижения\nДана хорошо работает.\n\nНа что обратить внимание\nТема уравнений.\n\nРекомендации\nРешать задачи дома.';
    expect(parentBlocks(text).map((block) => block.title)).toEqual([...PARENT_BLOCKS]);
    expect(joinBlocks(parentBlocks(text), false)).toBe(text);
  });
});

describe('статусы', () => {
  it('«Снят» — утверждённый отчёт со снятой публикацией; действующая публикация важнее состояния', () => {
    expect(reportStatus({ state: 'APPROVED', published: false, withdrawn: true }).label).toBe('Снят');
    expect(reportStatus({ state: 'APPROVED', published: false, withdrawn: false }).label).toBe('Утверждён');
    expect(reportStatus({ state: 'APPROVED', published: true, withdrawn: false }).label).toBe('Опубликован');
    expect(reportStatus({ state: 'DRAFT', published: false, withdrawn: true }).label).toBe('Черновик');
  });

  it('статус краткой версии: публикация считается, только если опубликована именно она', () => {
    const base = { parentSummary: { id: 2, status: 'CONFIRMED' } } as AiReport;
    expect(parentStatus({ ...base } as AiReport)?.label).toBe('Утверждён');
    expect(parentStatus({ ...base, publication: { parentSummaryId: 2, active: true } } as AiReport)?.label).toBe('Опубликован');
    expect(parentStatus({ ...base, publication: { parentSummaryId: 2, active: false } } as AiReport)?.label).toBe('Снят');
    expect(parentStatus({ ...base, publication: { parentSummaryId: 1, active: false } } as AiReport)?.label).toBe('Утверждён');
    expect(parentStatus({ parentSummary: { id: 3, status: 'DRAFT' } } as AiReport)?.label).toBe('Не утверждён');
  });
});

describe('период', () => {
  const custom = { kind: 'CUSTOM' as const, month: '', academicPeriodId: null };

  it('будущая дата, перевёрнутый диапазон и выход за год блокируют запуск', () => {
    expect(periodProblem({ ...custom, from: '2026-11-01', to: '2026-11-30' }, '2026-09-01', '2027-05-31', '2026-11-27'))
      .toBe('Период не может заканчиваться позже сегодняшнего дня.');
    expect(periodProblem({ ...custom, from: '2026-11-10', to: '2026-11-01' }, undefined, undefined, '2026-11-27'))
      .toBe('Начало периода позже конца.');
    expect(periodProblem({ ...custom, from: '2026-08-20', to: '2026-09-10' }, '2026-09-01', '2027-05-31', '2026-11-27'))
      .toBe('Даты должны быть внутри учебного года.');
    expect(periodProblem({ ...custom, from: '2026-11-01', to: '2026-11-27' }, '2026-09-01', '2027-05-31', '2026-11-27')).toBeNull();
  });

  it('месяцы года — до текущего, новые сверху', () => {
    expect(yearMonths('2026-09-01', '2027-05-31', '2026-11-27').map((item) => item.value)).toEqual(['2026-11', '2026-10', '2026-09']);
  });
});
