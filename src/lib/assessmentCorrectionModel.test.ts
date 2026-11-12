import { describe, expect, it } from 'vitest';
import {
  correctionProblem,
  hasMeaningfulReason,
  resultEventActor,
  resultEventTitle,
  scoreLabel,
} from './assessmentCorrectionModel';

describe('исправление балла СОЧ', () => {
  const base = { score: '31', reason: 'Не засчитана задача 4', currentScore: 20, maxScore: 40 };

  it('допустимое исправление ничем не блокируется', () => {
    expect(correctionProblem(base)).toBeNull();
    expect(correctionProblem({ ...base, score: '0' })).toBeNull();
    expect(correctionProblem({ ...base, score: '40' })).toBeNull();
  });

  it('блокирует отрицательный балл, выше максимума, дробный и пустой', () => {
    expect(correctionProblem({ ...base, score: '-1' })).toMatch(/отрицательным/);
    expect(correctionProblem({ ...base, score: '41' })).toMatch(/больше 40/);
    expect(correctionProblem({ ...base, score: '12.5' })).toMatch(/целое/);
    expect(correctionProblem({ ...base, score: ' ' })).toMatch(/Введите/);
  });

  it('тот же балл не сохраняется — записи об исправлении не будет', () => {
    expect(correctionProblem({ ...base, score: '20' })).toBe('Балл не изменился');
  });

  it('без содержательной причины не сохраняется', () => {
    expect(correctionProblem({ ...base, reason: '   ' })).toMatch(/причину/);
    expect(correctionProblem({ ...base, reason: '..' })).toMatch(/причину/);
    expect(hasMeaningfulReason('ок1')).toBe(true);
  });

  it('ноль и отсутствие балла различаются', () => {
    expect(scoreLabel(0, 40)).toBe('0 / 40');
    expect(scoreLabel(null, 40)).toBe('—');
  });

  it('событие истории называет было и стало', () => {
    expect(resultEventTitle({ scoreBefore: 20, scoreAfter: 31 }, 40)).toBe('Исправлено: 20 / 40 → 31 / 40');
    expect(resultEventTitle({ scoreBefore: undefined, scoreAfter: 20 }, 40)).toBe('Выставлено: 20 / 40');
    expect(resultEventActor({ actorName: 'Иванова А.', actorRole: 'TEACHER' })).toBe('Иванова А. · Учитель');
  });
});
