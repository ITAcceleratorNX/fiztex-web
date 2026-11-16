import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { ClassFinalGradeRow } from '@/lib/gradebookApi';
import { AttestationStatusModal, ChangeFinalResultModal } from './AttestationStatusModal';

const save = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useSetFinalGrade: () => ({ mutateAsync: save, isPending: false }),
}));

const placement = { subjectId: 2, academicPeriodId: 7 };
const draftFour = {
  studentProfileId: 4,
  studentName: 'Мухамеджанов Тимур',
  finalGrade: { id: 9, status: 'DRAFT', resultKind: 'NUMERIC', value: 4, version: 5 },
} as ClassFinalGradeRow;
const publishedVna = {
  studentProfileId: 3,
  studentName: 'Ахметов Нурсултан',
  finalGrade: { id: 7, status: 'PUBLISHED', resultKind: 'TEMP_UNATTESTED', value: undefined, version: 2 },
} as ClassFinalGradeRow;

describe('AttestationStatusModal (макет Т2, Т3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('без причины «Сохранить» неактивна; частая причина подставляется в поле', async () => {
    render(<AttestationStatusModal row={draftFour} kind="TEMP_UNATTESTED" placement={placement} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Временно не аттестован' })).toBeInTheDocument();
    expect(screen.getByText('Причина сохранится в истории итога')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Не сдан СОЧ' }));

    expect(screen.getByPlaceholderText('Например: не сдан СОЧ по уважительной причине')).toHaveValue('Не сдан СОЧ');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('сохраняет статус с причиной и версией строки', async () => {
    save.mockResolvedValue({});
    const onClose = vi.fn();
    render(<AttestationStatusModal row={draftFour} kind="NOT_ATTESTED" placement={placement} onClose={onClose} />);

    await userEvent.type(screen.getByRole('textbox'), 'Пропущено больше половины уроков');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      finalGradeId: 9, studentProfileId: 4, subjectId: 2, academicPeriodId: 7,
      resultKind: 'NOT_ATTESTED', value: null, resultReason: 'Пропущено больше половины уроков', expectedVersion: 5,
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('отказ сервера остаётся в окне и не выглядит успехом', async () => {
    save.mockRejectedValue(new ApiError(409, 'Итог изменился', 'FINAL_GRADE_VERSION_CHANGED'));
    const onClose = vi.fn();
    render(<AttestationStatusModal row={draftFour} kind="TEMP_UNATTESTED" placement={placement} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Не сданы СОР' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Итог изменили, пока окно было открыто');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ChangeFinalResultModal (макет Т4, Т6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('опубликованный ВНА: «Сейчас … ОПУБЛ.», выбранная оценка и обязательная причина', async () => {
    save.mockResolvedValue({});
    const onClose = vi.fn();
    render(<ChangeFinalResultModal row={publishedVna} values={[3, 4, 5]} initial={{ kind: 'NUMERIC', value: 4 }}
      placement={placement} onClose={onClose} />);

    expect(screen.getByText('Временно не аттестован')).toBeInTheDocument();
    expect(screen.getByText('ОПУБЛ.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'СОЧ сдан 12.01, работа оценена');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      finalGradeId: 7, resultKind: 'NUMERIC', value: 4, resultReason: 'СОЧ сдан 12.01, работа оценена', expectedVersion: 2,
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('без выбранного итога сохранить нельзя; особые результаты — рядом с оценками', async () => {
    render(<ChangeFinalResultModal row={draftFour} values={[2, 3, 4, 5]} otherKinds={['NOT_STUDIED']}
      placement={placement} onClose={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox'), 'Перевёлся из другой школы');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Не изучался' }));
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });
});
