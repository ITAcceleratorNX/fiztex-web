import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinalGradeHistoryModal } from './FinalGradeCorrectionModal';

const useFinalGradeHistory = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useFinalGradeHistory: (...args: unknown[]) => useFinalGradeHistory(...args),
  useCorrectFinalGrade: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRepublishFinalGrade: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const at = '2026-11-13T10:00:00Z';

describe('FinalGradeHistoryModal (ТЗ-2 §4)', () => {
  it('показывает цепочку: было → стало, причину, автора с ролью и публикации', () => {
    useFinalGradeHistory.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        { id: 1, action: 'CREATE', after: { value: null, resultKind: 'TEMP_UNATTESTED' }, reason: 'Длительная болезнь',
          actorName: 'Искаков А.', actorRole: 'TEACHER', createdAt: at },
        { id: 2, action: 'PUBLISH', before: { value: null, resultKind: 'TEMP_UNATTESTED' },
          after: { value: null, resultKind: 'TEMP_UNATTESTED' }, actorName: 'Искаков А.', actorRole: 'TEACHER', createdAt: at },
        { id: 3, action: 'PENDING_CHANGE', before: { value: null, resultKind: 'TEMP_UNATTESTED' },
          after: { value: null, resultKind: 'TEMP_UNATTESTED', pendingResultKind: 'NOT_ATTESTED' },
          reason: 'Решение педсовета №4', actorName: 'Сейтова Г.', actorRole: 'ADMIN', createdAt: at },
        { id: 4, action: 'REPUBLISH', before: { value: null, resultKind: 'TEMP_UNATTESTED', pendingResultKind: 'NOT_ATTESTED' },
          after: { value: null, resultKind: 'NOT_ATTESTED' }, actorName: 'Искаков А.', actorRole: 'TEACHER', createdAt: at },
      ],
    });

    render(<FinalGradeHistoryModal id={7} studentName="Сериков Данияр" onClose={() => undefined} />);

    expect(screen.getByText('Выставлено: ВНА')).toBeInTheDocument();
    expect(screen.getByText('Опубликовано: ВНА')).toBeInTheDocument();
    expect(screen.getByText('Изменено после публикации: ВНА → НА')).toBeInTheDocument();
    expect(screen.getByText('Повторно опубликовано: ВНА → НА')).toBeInTheDocument();
    expect(screen.getByText('Решение педсовета №4')).toBeInTheDocument();
    expect(screen.getByText(/Сейтова Г\. · Администрация/)).toBeInTheDocument();
    expect(screen.getByText(/видели прежнее значение до повторной публикации/)).toBeInTheDocument();
  });

  it('у записей до причин действия показывает основание и документы', () => {
    useFinalGradeHistory.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: 1, action: 'UPDATE', before: { value: 3 }, after: { value: 4, resultReason: 'Ошибка ввода',
        correctionReference: 'Протокол №7' }, actorName: 'Сейтова Г.', actorRole: 'SUPER_ADMIN', createdAt: at }],
    });

    render(<FinalGradeHistoryModal id={7} studentName="Сериков Данияр" onClose={() => undefined} />);

    expect(screen.getByText('Изменено: 3 → 4')).toBeInTheDocument();
    expect(screen.getByText('Ошибка ввода')).toBeInTheDocument();
    expect(screen.getByText('Протокол №7')).toBeInTheDocument();
  });

  it('пустая история — словами', () => {
    useFinalGradeHistory.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(<FinalGradeHistoryModal id={7} studentName="Сериков Данияр" onClose={() => undefined} />);
    expect(screen.getByText('Событий пока нет')).toBeInTheDocument();
  });
});
