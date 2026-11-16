import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinalGradeHistoryModal } from './FinalGradeCorrectionModal';

const useFinalGradeHistory = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useFinalGradeHistory: (...args: unknown[]) => useFinalGradeHistory(...args),
  useCorrectFinalGrade: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRepublishFinalGrade: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('FinalGradeHistoryModal (макет Т7, А2)', () => {
  it('новое сверху: «было → стало», причина, кто и когда', () => {
    useFinalGradeHistory.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        { id: 1, action: 'CREATE', after: { resultKind: 'TEMP_UNATTESTED' }, reason: 'Не сдан СОЧ по уважительной причине',
          actorName: 'Марина Демо', createdAt: '2026-12-18T09:05:00Z' },
        { id: 2, action: 'PUBLISH', before: { resultKind: 'TEMP_UNATTESTED' }, after: { resultKind: 'TEMP_UNATTESTED' },
          actorName: 'Марина Демо', createdAt: '2026-12-28T05:00:00Z' },
        { id: 3, action: 'UPDATE', before: { resultKind: 'TEMP_UNATTESTED' }, after: { value: 4, resultKind: 'NUMERIC' },
          reason: 'СОЧ сдан 12.01, работа оценена', actorName: 'Марина Демо', createdAt: '2027-01-13T06:20:00Z' },
      ],
    });

    render(<FinalGradeHistoryModal id={6} studentName="Ахметов Нурсултан" onClose={vi.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Изменение: Временно не аттестован → 4');
    expect(items[0]).toHaveTextContent('Причина: СОЧ сдан 12.01, работа оценена');
    expect(within(items[0]).getByText(/^Марина Демо · 13\.01\.2027/)).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('Публикация: Временно не аттестован → Временно не аттестован');
    expect(items[1]).not.toHaveTextContent('Причина');
    expect(items[2]).toHaveTextContent('Создание: — → Временно не аттестован');
  });

  it('техисправление показывает документ и протокол', () => {
    useFinalGradeHistory.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        { id: 7, action: 'UPDATE', before: { resultKind: 'NOT_ATTESTED' },
          after: { resultKind: 'TEMP_UNATTESTED', correctionReference: 'Протокол №7 от 13.11' },
          reason: 'Ошибка ввода при выставлении', actorName: 'Сейтова Г.', createdAt: '2026-12-29T05:00:00Z' },
      ],
    });

    render(<FinalGradeHistoryModal id={8} studentName="Жумабаев Ерасыл" onClose={vi.fn()} />);

    expect(screen.getByText('Исправление технической ошибки: Не аттестован → Временно не аттестован')).toBeInTheDocument();
    expect(screen.getByText('Документ: Протокол №7 от 13.11')).toBeInTheDocument();
  });
});
