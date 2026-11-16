import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { ClassFinalGradeRow } from '@/lib/gradebookApi';
import { AttestationStatusModal } from './AttestationStatusModal';

const save = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useSaveAttestationStatus: () => ({ mutateAsync: save, isPending: false }),
}));

const publishedSix = {
  studentProfileId: 4,
  studentName: 'Сериков Данияр',
  finalGrade: { id: 9, status: 'PUBLISHED', resultKind: 'NUMERIC', value: 6, version: 5, publicationState: 'PUBLISHED' },
} as ClassFinalGradeRow;

function open(row: ClassFinalGradeRow, target: { kind: 'TEMP_UNATTESTED' | 'NOT_ATTESTED' | 'NUMERIC'; value: number | null },
  author: 'TEACHER' | 'ADMINISTRATION' = 'TEACHER') {
  const onClose = vi.fn();
  render(<AttestationStatusModal row={row} target={target} author={author} subjectId={2} academicPeriodId={7} onClose={onClose} />);
  return onClose;
}

describe('AttestationStatusModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('без причины не отправляет и объясняет, сколько нужно', async () => {
    open(publishedSix, { kind: 'NOT_ATTESTED', value: null });

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить статус' }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите причину — не короче 5 символов')).toBeInTheDocument();
  });

  it('у опубликованного итога предупреждает, что семья видит прежнее до подтверждения', async () => {
    save.mockResolvedValue({});
    const onClose = open(publishedSix, { kind: 'NOT_ATTESTED', value: null }, 'ADMINISTRATION');

    expect(screen.getByText(/продолжат видеть «6», пока учитель не подтвердит изменение/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), '  Решение педсовета №4  ');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить статус' }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      author: 'ADMINISTRATION', resultKind: 'NOT_ATTESTED', value: null, reason: 'Решение педсовета №4',
      finalGrade: publishedSix.finalGrade, studentProfileId: 4,
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('отказ сервера остаётся в окне и не выглядит успехом', async () => {
    save.mockRejectedValue(new ApiError(409, 'Итог изменился', 'FINAL_GRADE_VERSION_CHANGED'));
    const onClose = open(publishedSix, { kind: 'TEMP_UNATTESTED', value: null });

    await userEvent.click(screen.getByRole('button', { name: 'Пропуски по уважительной причине' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить статус' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Итог изменили, пока окно было открыто');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('снятие статуса числом — своё название и без заготовок причин статуса', () => {
    const row = { ...publishedSix, finalGrade: { ...publishedSix.finalGrade, resultKind: 'TEMP_UNATTESTED', value: undefined } } as ClassFinalGradeRow;
    open(row, { kind: 'NUMERIC', value: 7 });

    expect(screen.getByRole('button', { name: 'Снять статус' })).toBeInTheDocument();
    expect(screen.queryByText('Частые причины')).toBeNull();
    expect(screen.getByText('Временно не аттестован')).toBeInTheDocument();
  });

  it('выбор опубликованного поверх ожидающего — отмена изменения', () => {
    const row = {
      ...publishedSix,
      finalGrade: {
        ...publishedSix.finalGrade, publicationState: 'CHANGED_AFTER_PUBLICATION',
        pendingChange: { resultKind: 'TEMP_UNATTESTED', reason: 'Болел' },
      },
    } as ClassFinalGradeRow;
    open(row, { kind: 'NUMERIC', value: 6 });

    expect(screen.getByRole('heading', { name: 'Отменить изменение' })).toBeInTheDocument();
    expect(screen.getByText(/вернётся к опубликованному: «6»/)).toBeInTheDocument();
  });
});
