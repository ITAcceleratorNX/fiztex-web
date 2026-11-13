import { describe, expect, it } from 'vitest';
import type { FinalGrade } from './gradebookApi';
import {
  authorLabel,
  decidedResult,
  familySees,
  fullResultLabel,
  historyEventNote,
  historyEventTitle,
  isAttestationStatus,
  needsReason,
  publicationBadge,
  reasonProblem,
  shortResultLabel,
  type FinalGradeHistoryEvent,
} from './attestationModel';
import { finalResultLabel } from './finalGradeResult';

const published = (patch: Partial<FinalGrade> = {}): FinalGrade => ({
  id: 1, status: 'PUBLISHED', resultKind: 'NUMERIC', value: 6, version: 2,
  publicationState: 'PUBLISHED', ...patch,
});

describe('attestationModel', () => {
  it('knows the two statuses and nothing else', () => {
    expect(isAttestationStatus('TEMP_UNATTESTED')).toBe(true);
    expect(isAttestationStatus('NOT_ATTESTED')).toBe(true);
    expect(isAttestationStatus('NOT_STUDIED')).toBe(false);
    expect(isAttestationStatus('NUMERIC')).toBe(false);
    expect(isAttestationStatus(null)).toBe(false);
  });

  it('asks for a reason whenever a status is set or removed', () => {
    expect(needsReason(null, 'TEMP_UNATTESTED')).toBe(true);
    expect(needsReason('NOT_ATTESTED', 'NUMERIC')).toBe(true);
    expect(needsReason('NUMERIC', 'NUMERIC')).toBe(false);
    expect(needsReason(undefined, 'NUMERIC')).toBe(false);
  });

  it('hints at the reason length the server expects', () => {
    expect(reasonProblem('   ')).toBe('Укажите причину — не короче 5 символов');
    expect(reasonProblem(' abcd ')).not.toBeNull();
    expect(reasonProblem('Болел')).toBeNull();
    expect(reasonProblem('я'.repeat(1001))).toBe('Причина длиннее 1000 символов');
  });

  it('labels statuses short in a cell and in full in text', () => {
    expect(shortResultLabel({ kind: 'TEMP_UNATTESTED', value: null })).toBe('ВНА');
    expect(shortResultLabel({ kind: 'NOT_ATTESTED', value: null })).toBe('НА');
    expect(shortResultLabel({ kind: 'NUMERIC', value: 7 })).toBe('7');
    expect(shortResultLabel({ kind: 'PASS', value: null })).toBe('Зачёт');
    expect(fullResultLabel({ kind: 'NOT_ATTESTED', value: null })).toBe('Не аттестован');
    expect(finalResultLabel(published({ resultKind: 'NOT_ATTESTED', value: undefined }))).toBe('Не аттестован');
  });

  it('separates what the school decided from what the family sees', () => {
    const changed = published({
      resultKind: 'TEMP_UNATTESTED', value: undefined, publicationState: 'CHANGED_AFTER_PUBLICATION',
      pendingChange: { resultKind: 'NUMERIC', value: 7, reason: 'Сдал СОЧ' },
    });

    expect(decidedResult(changed)).toEqual({ kind: 'NUMERIC', value: 7 });
    expect(familySees(changed)).toEqual({ kind: 'TEMP_UNATTESTED', value: null });
    expect(familySees(published({ status: 'DRAFT' }))).toBeNull();
    expect(decidedResult(null)).toBeNull();
  });

  it('names the three publication states, and falls back to status for old answers', () => {
    expect(publicationBadge(published({ status: 'DRAFT', publicationState: 'DRAFT' }))?.label).toBe('Черновик');
    expect(publicationBadge(published())?.label).toBe('Опубликовано');
    expect(publicationBadge(published({ publicationState: 'CHANGED_AFTER_PUBLICATION' })))
      .toEqual({ label: 'Изменено после публикации', tone: 'amber' });
    expect(publicationBadge(published({ publicationState: undefined }))?.label).toBe('Опубликовано');
    expect(publicationBadge(null)).toBeNull();
  });

  it('says whose decision it was', () => {
    expect(authorLabel('Иванова А.', 'ADMIN')).toBe('Иванова А. · Администрация');
    expect(authorLabel('Петров Б.', 'TEACHER')).toBe('Петров Б. · Учитель');
    expect(authorLabel(null, undefined)).toBe('Сотрудник школы');
  });

  describe('history', () => {
    const event = (patch: Partial<FinalGradeHistoryEvent>): FinalGradeHistoryEvent => ({ id: 1, ...patch });

    it('shows a change after publication as decided before → decided after', () => {
      const pending = event({
        action: 'PENDING_CHANGE',
        before: { value: null, resultKind: 'TEMP_UNATTESTED' },
        after: { value: null, resultKind: 'TEMP_UNATTESTED', pendingResultKind: 'NUMERIC', pendingValue: 7 },
      });

      expect(historyEventTitle(pending)).toBe('Изменено после публикации: ВНА → 7');
      expect(historyEventNote(pending)).toContain('видели прежнее');
    });

    it('names a discarded pending change as such', () => {
      const discarded = event({
        action: 'PENDING_CHANGE',
        before: { value: 6, resultKind: 'NUMERIC', pendingResultKind: 'TEMP_UNATTESTED' },
        after: { value: 6, resultKind: 'NUMERIC' },
      });

      expect(historyEventTitle(discarded)).toBe('Изменение после публикации отменено: ВНА → 6');
      expect(historyEventNote(discarded)).toBeNull();
    });

    it('reads republication and old snapshots without the new fields', () => {
      expect(historyEventTitle(event({
        action: 'REPUBLISH',
        before: { value: null, resultKind: 'TEMP_UNATTESTED', pendingResultKind: 'NOT_ATTESTED' },
        after: { value: null, resultKind: 'NOT_ATTESTED' },
      }))).toBe('Повторно опубликовано: ВНА → НА');
      expect(historyEventTitle(event({ action: 'CREATE', after: { value: 4 } }))).toBe('Выставлено: 4');
      expect(historyEventTitle(event({ action: 'UPDATE', before: { value: 4 }, after: { value: 5 } })))
        .toBe('Изменено: 4 → 5');
      expect(historyEventTitle(event({ action: 'PUBLISH', after: null }))).toBe('Опубликовано: —');
    });
  });
});
