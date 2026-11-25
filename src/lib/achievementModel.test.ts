import { describe, expect, it } from 'vitest';
import {
  draftFromAchievement,
  inactiveSelectedClasses,
  pdfProblem,
  requestFromForm,
  validateForm,
  visibilityDraftError,
  visibilitySummary,
  EMPTY_FORM,
} from './achievementModel';
import type { TeacherAchievement } from './achievementsApi';

const base: TeacherAchievement = { id: 1, title: 'Диплом', visibility: 'PRIVATE', classes: [], visibleToParents: false };
const pdf = (name = 'd.pdf', size = 10, type = 'application/pdf') =>
  new File([new Uint8Array(size)], name, { type });

describe('visibilitySummary', () => {
  it('закрытый документ — «Только я»', () => {
    expect(visibilitySummary(base).label).toBe('Только я');
  });

  it('выбранные классы называет только действующие', () => {
    const summary = visibilitySummary({
      ...base,
      visibility: 'SELECTED_CLASSES',
      visibleToParents: true,
      classes: [{ id: 1, name: '7А', active: true }, { id: 2, name: '6Б', active: false }],
    });
    expect(summary).toMatchObject({ label: 'Родители: 7А', tone: 'green' });
  });

  it('открыт, но никому — когда выбранные классы учитель больше не ведёт', () => {
    const summary = visibilitySummary({
      ...base,
      visibility: 'SELECTED_CLASSES',
      visibleToParents: false,
      classes: [{ id: 2, name: '6Б', active: false }],
    });
    expect(summary).toMatchObject({ label: 'Не видно никому', tone: 'amber' });
  });
});

describe('draft доступа', () => {
  it('в черновик попадают только действующие классы', () => {
    const achievement: TeacherAchievement = {
      ...base,
      visibility: 'SELECTED_CLASSES',
      classes: [{ id: 1, name: '7А', active: true }, { id: 2, name: '6Б', active: false }],
    };
    expect(draftFromAchievement(achievement).classIds).toEqual([1]);
    expect(inactiveSelectedClasses(achievement)).toEqual(['6Б']);
  });

  it('пустой выбор классов не публикуется', () => {
    expect(visibilityDraftError({ visibility: 'SELECTED_CLASSES', classIds: [] }, 2)).toBe('Выберите хотя бы один класс');
    expect(visibilityDraftError({ visibility: 'ALL_CLASSES', classIds: [] }, 0)).not.toBeNull();
    expect(visibilityDraftError({ visibility: 'PRIVATE', classIds: [] }, 0)).toBeNull();
  });
});

describe('форма', () => {
  it('требует название и PDF при добавлении', () => {
    const errors = validateForm(EMPTY_FORM, null, { fileRequired: true, today: '2026-11-24' });
    expect(errors.title).not.toBeNull();
    expect(errors.file).not.toBeNull();
  });

  it('при правке файл необязателен, будущая дата — ошибка', () => {
    const errors = validateForm({ ...EMPTY_FORM, title: 'Х', receivedOn: '2027-01-01' }, null,
      { fileRequired: false, today: '2026-11-24' });
    expect(errors.file).toBeNull();
    expect(errors.receivedOn).not.toBeNull();
  });

  it('отклоняет не-PDF, пустой и слишком большой файл', () => {
    expect(pdfProblem(pdf('a.docx', 10, 'application/msword'))).not.toBeNull();
    expect(pdfProblem(pdf('a.pdf', 0))).not.toBeNull();
    expect(pdfProblem({ name: 'a.pdf', type: 'application/pdf', size: 51 * 1024 * 1024 } as File)).not.toBeNull();
    expect(pdfProblem(pdf())).toBeNull();
  });

  it('пустые необязательные поля уходят undefined', () => {
    expect(requestFromForm({ ...EMPTY_FORM, title: '  Диплом ', organization: '   ' })).toEqual({
      title: 'Диплом',
      category: undefined,
      receivedOn: undefined,
      organization: undefined,
      description: undefined,
    });
  });
});
