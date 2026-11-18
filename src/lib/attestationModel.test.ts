import { describe, expect, it } from 'vitest';
import {
  currentResult,
  fullResultLabel,
  hasNotableHistory,
  historyEventAuthor,
  historyEventTitle,
  reasonCaption,
  reasonProblem,
  shortResultLabel,
  type FinalGradeHistoryEvent,
} from './attestationModel';

describe('attestationModel', () => {
  it('причина — от 5 до 1000 символов после обрезки пробелов', () => {
    expect(reasonProblem('  abcd ')).toMatch(/не короче 5/);
    expect(reasonProblem('Не сдан СОЧ')).toBeNull();
    expect(reasonProblem('я'.repeat(1001))).toMatch(/длиннее 1000/);
  });

  it('называет результат коротко для ячейки и полностью для текста', () => {
    expect(shortResultLabel({ kind: 'TEMP_UNATTESTED', value: null })).toBe('ВНА');
    expect(fullResultLabel({ kind: 'NOT_ATTESTED', value: null })).toBe('Не аттестован');
    expect(shortResultLabel({ kind: 'NUMERIC', value: 4 })).toBe('4');
    expect(fullResultLabel(null)).toBe('—');
    expect(currentResult({ resultKind: 'TEMP_UNATTESTED', value: undefined })).toEqual({ kind: 'TEMP_UNATTESTED', value: null });
    expect(reasonCaption('NOT_ATTESTED')).toBe('Причина не аттестован');
  });

  it('значок истории: у статуса всегда, у числа — когда было что-то кроме выставления и публикации', () => {
    expect(hasNotableHistory({ finalGrade: { id: 1, status: 'DRAFT', resultKind: 'TEMP_UNATTESTED' }, historyCount: 1 })).toBe(true);
    expect(hasNotableHistory({ finalGrade: { id: 1, status: 'PUBLISHED', resultKind: 'NUMERIC' }, historyCount: 2 })).toBe(false);
    expect(hasNotableHistory({ finalGrade: { id: 1, status: 'PUBLISHED', resultKind: 'NUMERIC' }, historyCount: 3 })).toBe(true);
    expect(hasNotableHistory({ finalGrade: { id: 1, status: 'DRAFT', resultKind: 'NUMERIC' }, historyCount: 1 })).toBe(false);
    expect(hasNotableHistory({ finalGrade: undefined, historyCount: 0 })).toBe(false);
  });

  describe('история (макет Т7, А2)', () => {
    // Снимки истории в типах API — `JsonNode` (пустой объект), а сервер шлёт в них поля итога:
    // в тесте они задаются обычным объектом, как приходят в ответе.
    type Snapshot = Record<string, unknown> | null;
    const event = (
      patch: Omit<Partial<FinalGradeHistoryEvent>, 'before' | 'after'> & { before?: Snapshot; after?: Snapshot },
    ): FinalGradeHistoryEvent => ({ id: 1, ...patch }) as unknown as FinalGradeHistoryEvent;

    it('«было → стало» полными словами у каждого действия', () => {
      expect(historyEventTitle(event({ action: 'CREATE', after: { resultKind: 'TEMP_UNATTESTED' } })))
        .toBe('Выставлен итог: Временно не аттестован');
      expect(historyEventTitle(event({
        action: 'PUBLISH', before: { resultKind: 'TEMP_UNATTESTED' }, after: { resultKind: 'TEMP_UNATTESTED' },
      }))).toBe('Публикация: Временно не аттестован');
      expect(historyEventTitle(event({ action: 'REPUBLISH', before: { resultKind: 'PASS' }, after: { resultKind: 'FAIL' } })))
        .toBe('Повторная публикация: Зачёт → Незачёт');
      expect(historyEventTitle(event({ action: 'UPDATE', before: { resultKind: 'TEMP_UNATTESTED' }, after: { value: 4 } })))
        .toBe('Изменение: Временно не аттестован → 4');
    });

    it('техисправление администрации названо своим именем', () => {
      expect(historyEventTitle(event({
        action: 'UPDATE', before: { resultKind: 'NOT_ATTESTED' },
        after: { resultKind: 'TEMP_UNATTESTED', correctionReference: 'Протокол №7' },
      }))).toBe('Исправление технической ошибки: Не аттестован → Временно не аттестован');
    });

    it('старое событие «ждало подтверждения» читается с тем, что было решено', () => {
      expect(historyEventTitle(event({
        action: 'PENDING_CHANGE', before: { resultKind: 'TEMP_UNATTESTED' },
        after: { resultKind: 'TEMP_UNATTESTED', pendingResultKind: 'NUMERIC', pendingValue: 7 },
      }))).toBe('Изменение без публикации: Временно не аттестован → 7');
    });

    it('кто и когда — «Имя · дд.мм.гггг, чч:мм:сс»', () => {
      const line = historyEventAuthor(event({ actorName: 'Марина Демо', createdAt: '2027-01-13T06:20:00Z' }));
      expect(line).toMatch(/^Марина Демо · 13\.01\.2027, \d{2}:20:00$/);
      expect(historyEventAuthor(event({}))).toBe('Сотрудник школы');
    });
  });
});
