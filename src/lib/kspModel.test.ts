import { describe, expect, it } from 'vitest';
import type { KspContext } from './kspApi';
import {
  buildGenerateRequest,
  durationSummary,
  emptyPrepForm,
  entryCaption,
  exportFileName,
  fromEditor,
  moveStage,
  newStage,
  prepFormFromSource,
  regenerateRequest,
  sameDocument,
  serverFieldErrors,
  toEditor,
  validateEditor,
  validatePrep,
  wishesLabel,
} from './kspModel';

const ktp = { section: 'Раздел 2. Обыкновенные дроби', topic: 'Умножение дробей', learningObjectives: '5.1.2.4 умножать дроби' };

const withKtp: KspContext = {
  lessonId: 1, ktp, topicMismatch: false, missingFields: [], defaultLanguage: 'ru',
  hints: [{ id: 'GROUP_WORK', label: 'Групповая работа' }, { id: 'REFLECTION', label: 'Рефлексия' }],
};
const withoutKtp: KspContext = { lessonId: 1, topicMismatch: false, missingFields: ['SECTION', 'TOPIC', 'LEARNING_OBJECTIVES'], defaultLanguage: 'ru' };
const mismatch: KspContext = {
  ...withKtp, topicMismatch: true, lesson: { topic: 'Решение задач на умножение дробей' },
};

describe('entryCaption', () => {
  it('names each of the four server states', () => {
    expect(entryCaption('NOT_CREATED', undefined)).toMatch(/по форме приказа №130/);
    expect(entryCaption('GENERATING', undefined)).toBe('ИИ составляет план…');
    expect(entryCaption('UNSAVED', undefined)).toMatch(/не сохранён/);
    expect(entryCaption('SAVED', { exists: true, updatedAt: '2026-11-12T09:20:00Z' })).toMatch(/^Сохранён \d\d\.11\.2026 в \d\d:20$/);
  });
});

describe('preparation', () => {
  it('needs nothing typed when KTP has every field', () => {
    const form = emptyPrepForm(withKtp);
    expect(validatePrep(withKtp, form)).toEqual({});
    expect(buildGenerateRequest(withKtp, form)).toMatchObject({ ...ktp, language: 'ru' });
  });

  it('asks for every field without KTP and never invents objectives', () => {
    const errors = validatePrep(withoutKtp, emptyPrepForm(withoutKtp));
    expect(Object.keys(errors).sort()).toEqual(['learningObjectives', 'section', 'topic']);
  });

  it('prefills the lesson topic when there is no KTP', () => {
    const context = { ...withoutKtp, lesson: { topic: 'Свободная тема' } };
    expect(emptyPrepForm(context).topic).toBe('Свободная тема');
  });

  it('does not pick a topic on mismatch until the teacher does', () => {
    const form = emptyPrepForm(mismatch);
    expect(validatePrep(mismatch, form).topicChoice).toBeDefined();
    expect(buildGenerateRequest(mismatch, { ...form, topicChoice: 'LESSON' }).topic).toBe('Решение задач на умножение дробей');
    // Цели урока без своих целей остаются целями КТП.
    expect(buildGenerateRequest(mismatch, { ...form, topicChoice: 'LESSON' }).learningObjectives).toBe(ktp.learningObjectives);
    expect(buildGenerateRequest(mismatch, { ...form, topicChoice: 'KTP' }).topic).toBe(ktp.topic);
  });

  it('keeps empty attendance empty instead of zero', () => {
    const request = buildGenerateRequest(withKtp, emptyPrepForm(withKtp));
    expect(request.presentCount).toBeUndefined();
    expect(request.absentCount).toBeUndefined();
    expect(buildGenerateRequest(withKtp, { ...emptyPrepForm(withKtp), presentCount: '0' }).presentCount).toBe(0);
    expect(validatePrep(withKtp, { ...emptyPrepForm(withKtp), absentCount: '-1' }).absentCount).toBeDefined();
  });

  it('restores typed values, wishes and the topic choice from a failed job', () => {
    const form = prepFormFromSource(mismatch, {
      topic: 'Решение задач на умножение дробей', wishes: 'Задача про рецепт', hintIds: ['GROUP_WORK'], presentCount: 20,
    });
    expect(form).toMatchObject({ topicChoice: 'LESSON', wishes: 'Задача про рецепт', hintIds: ['GROUP_WORK'], presentCount: '20' });
  });

  it('labels wishes with hint names first', () => {
    expect(wishesLabel({ hintIds: ['GROUP_WORK', 'REFLECTION'], wishes: 'Начать с повторения' }, withKtp.hints))
      .toBe('Групповая работа, Рефлексия. Начать с повторения');
  });

  it('regenerates a saved plan from the saved header and the last wishes', () => {
    const request = regenerateRequest(
      { topic: 'Исправленная тема', learningObjectives: 'Цели', section: 'Раздел', language: 'kk', stages: [] },
      { wishes: 'Больше практики', hintIds: ['GROUP_WORK'], topic: 'Старая тема' },
    );
    expect(request).toMatchObject({ topic: 'Исправленная тема', wishes: 'Больше практики', hintIds: ['GROUP_WORK'], language: 'kk' });
  });
});

describe('editor', () => {
  const document = {
    language: 'ru', topic: 'Тема', learningObjectives: 'Цели', lessonObjectives: 'Цели урока', presentCount: undefined,
    stages: [
      { stage: 'Начало', durationMinutes: 7, teacherActions: 'А', studentActions: 'Б', assessment: 'В', resources: 'Г' },
      { stage: 'Конец', durationMinutes: 38, teacherActions: '', studentActions: '', assessment: '', resources: '' },
    ],
  };

  it('round-trips a document without inventing zeros', () => {
    const back = fromEditor(toEditor(document));
    expect(back.stages).toEqual(document.stages);
    expect(back.presentCount).toBeUndefined();
  });

  it('detects manual edits but not reordering back', () => {
    const base = toEditor(document);
    const edited = { ...base, topic: 'Другая' };
    expect(sameDocument(base, toEditor(document))).toBe(true);
    expect(sameDocument(base, edited)).toBe(false);
    const swapped = { ...base, stages: moveStage(base.stages, 0, 1) };
    expect(sameDocument(base, swapped)).toBe(false);
    expect(sameDocument(base, { ...swapped, stages: moveStage(swapped.stages, 1, 0) })).toBe(true);
  });

  it('warns about the sum without fixing it', () => {
    const editor = toEditor(document);
    expect(durationSummary(editor.stages, 45)).toMatchObject({ sum: 45, mismatch: false, incomplete: false });
    editor.stages[1].minutes = '43';
    expect(durationSummary(editor.stages, 45)).toMatchObject({ sum: 50, mismatch: true });
    expect(durationSummary([...editor.stages, newStage()], 45)).toMatchObject({ incomplete: true, mismatch: false });
  });

  it('validates with the same keys the server uses', () => {
    const editor = { ...toEditor(document), lessonObjectives: ' ' };
    editor.stages[0].stage = '';
    editor.stages[1].minutes = '700';
    expect(validateEditor(editor)).toEqual({
      'document.lessonObjectives': 'Укажите цели урока',
      'document.stages[0].stage': 'Укажите название этапа',
      'document.stages[1].durationMinutes': 'От 1 до 600',
    });
    expect(serverFieldErrors([{ field: 'document.topic', message: 'Укажите тему урока' }]))
      .toEqual({ 'document.topic': 'Укажите тему урока' });
  });
});

describe('exportFileName', () => {
  it('follows the server rule', () => {
    expect(exportFileName({ className: '5 «А»', lessonDate: '2026-11-13', stages: [] }, 'docx')).toBe('КСП_5__А__2026-11-13.docx');
    expect(exportFileName({ stages: [] }, 'pdf')).toBe('КСП.pdf');
  });
});
