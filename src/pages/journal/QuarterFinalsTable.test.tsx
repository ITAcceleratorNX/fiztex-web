import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuarterFinalsTable } from './QuarterFinalsTable';

type Finals = Parameters<typeof QuarterFinalsTable>[0]['finals'];

const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function finals(row: Record<string, unknown>, canManage = true): Finals {
  return {
    canManage,
    canManageAttestation: true,
    gradingPolicy: { policyId: 1 },
    allowedValues: TEN,
    allowedResultKinds: ['NUMERIC', 'TEMP_UNATTESTED', 'NOT_ATTESTED', 'NOT_STUDIED'],
    assessmentMode: 'NUMERIC',
    rows: [{
      studentProfileId: 1, studentName: 'Айдар Нурланов', currentMember: true,
      canEditResult: canManage, canChangeAttestation: true, canConfirmPublication: false, historyCount: 1,
      ...row,
    }],
  } as unknown as Finals;
}

const published = { id: 5, status: 'PUBLISHED', value: 4, resultKind: 'NUMERIC', version: 2, publicationState: 'PUBLISHED' };
const publishedVna = {
  id: 6, status: 'PUBLISHED', value: null, resultKind: 'TEMP_UNATTESTED', version: 3, publicationState: 'PUBLISHED',
};
const vnaPendingSeven = {
  ...publishedVna,
  publicationState: 'CHANGED_AFTER_PUBLICATION',
  pendingChange: { resultKind: 'NUMERIC', value: 7, reason: 'Сдал СОЧ', changedByName: 'Иванова А.', changedByRole: 'ADMIN' },
};

function renderTable(row: Record<string, unknown>, canManage = true) {
  const handlers = { onPick: vi.fn(), onRepublish: vi.fn(), onRequestStatus: vi.fn(), onPickResult: vi.fn() };
  render(
    <QuarterFinalsTable
      finals={finals(row, canManage)}
      highlighted={new Set()}
      busyStudentId={null}
      {...handlers}
    />,
  );
  return handlers;
}

describe('предварительная оценка и повторное подтверждение', () => {
  it('до СОЧ показатель помечен «Предварительно», а не выдан за итог', () => {
    renderTable({
      result: { status: 'CALCULATED', percent: 80, roundedPercent: 80, recommendedValue: 4, missingComponents: ['SOCH'] },
      recommendedValue: 4,
    });
    expect(screen.getAllByText('Предварительно').length).toBeGreaterThan(0);
    expect(screen.getByText('без СОЧ')).toBeInTheDocument();
  });

  it('после СОЧ пометки нет', () => {
    renderTable({
      result: { status: 'CALCULATED', percent: 80, roundedPercent: 80, recommendedValue: 4, missingComponents: [] },
      recommendedValue: 4,
    });
    expect(screen.queryByText('Предварительно')).toBeNull();
  });

  it('нехватка данных — причина словами, а не процент', () => {
    renderTable({ result: { status: 'INCOMPLETE', missingComponents: ['SOCH'] }, recommendedValue: null });
    expect(screen.getByText('Нет СОЧ')).toBeInTheDocument();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('опубликованный итог с изменившейся рекомендацией просит подтверждения и зовёт его по кнопке', async () => {
    const { onRepublish } = renderTable({
      result: { status: 'CALCULATED', percent: 90, recommendedValue: 5, missingComponents: [] },
      recommendedValue: 5, finalGrade: published, recommendationChanged: true,
      canEditResult: false, canConfirmPublication: true,
    });
    expect(screen.getByText(/Требуется повторное подтверждение/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить и опубликовать' }));
    expect(onRepublish).toHaveBeenCalledTimes(1);
  });

  it('кнопку подтверждения показывает сервер, а не сочетание флагов на клиенте', () => {
    renderTable({ recommendedValue: 5, finalGrade: published, recommendationChanged: true, canConfirmPublication: false });
    expect(screen.queryByRole('button', { name: 'Подтвердить и опубликовать' })).toBeNull();
  });
});

describe('статусы ВНА/НА в ячейке итога (ATTESTATION-001)', () => {
  it('один ряд: 1…10 и ВНА/НА, выбор статуса просит причину, а не сохраняет сразу', async () => {
    const { onRequestStatus, onPick } = renderTable({});

    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'НА — Не аттестован' }));

    expect(onRequestStatus).toHaveBeenCalledWith(expect.objectContaining({ studentProfileId: 1 }),
      { kind: 'NOT_ATTESTED', value: null });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('число в строке без статуса сохраняется сразу', async () => {
    const { onPick, onRequestStatus } = renderTable({});
    await userEvent.click(screen.getByRole('button', { name: '7' }));
    expect(onPick).toHaveBeenCalledWith(expect.anything(), 7);
    expect(onRequestStatus).not.toHaveBeenCalled();
  });

  it('число поверх статуса — снятие статуса, через окно с причиной', async () => {
    const { onPick, onRequestStatus } = renderTable({
      finalGrade: { id: 6, status: 'DRAFT', value: null, resultKind: 'TEMP_UNATTESTED', publicationState: 'DRAFT' },
    });

    expect(screen.getByRole('button', { name: 'ВНА — Временно не аттестован' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'ВНА — Временно не аттестован' }));
    expect(onRequestStatus).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '8' }));
    expect(onRequestStatus).toHaveBeenCalledWith(expect.anything(), { kind: 'NUMERIC', value: 8 });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText('Черновик')).toBeInTheDocument();
  });

  it('у опубликованного числа нет обычной правки — только статусы', () => {
    renderTable({ finalGrade: published, canEditResult: false });

    expect(screen.queryByRole('button', { name: '5' })).toBeNull();
    // Само число на месте — выбранным, но не кнопкой: иначе в ячейке не было бы итога.
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
    expect(screen.getByRole('button', { name: 'ВНА — Временно не аттестован' })).toBeInTheDocument();
    expect(screen.getByText('Опубликовано')).toBeInTheDocument();
  });

  it('изменение после публикации: что видит семья, что ждёт подтверждения, кто изменил', async () => {
    const { onRepublish, onRequestStatus } = renderTable({
      finalGrade: vnaPendingSeven, canConfirmPublication: true,
    });

    expect(screen.getByText('Изменено после публикации')).toBeInTheDocument();
    expect(screen.getByText(/Ученик видит «Временно не аттестован»\. Ждёт подтверждения: «7»/)).toBeInTheDocument();
    expect(screen.getByText(/Иванова А\. · Администрация/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить и опубликовать' }));
    expect(onRepublish).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Отменить изменение' }));
    expect(onRequestStatus).toHaveBeenCalledWith(expect.anything(), { kind: 'TEMP_UNATTESTED', value: null });
  });

  it('администрация меняет статус, но подтверждает учитель', () => {
    renderTable({ finalGrade: vnaPendingSeven, canEditResult: false, canConfirmPublication: false }, false);

    expect(screen.queryByRole('button', { name: 'Подтвердить и опубликовать' })).toBeNull();
    expect(screen.getByText('Подтверждает учитель предмета')).toBeInTheDocument();
  });

  it('администрация снимает опубликованный статус числом — через окно с причиной', async () => {
    const { onRequestStatus } = renderTable({ finalGrade: publishedVna, canEditResult: false }, false);

    await userEvent.click(screen.getByRole('button', { name: '6' }));
    expect(onRequestStatus).toHaveBeenCalledWith(expect.anything(), { kind: 'NUMERIC', value: 6 });
  });

  it('у администрации без статуса в строке чисел нет вовсе', () => {
    renderTable({ finalGrade: published, canEditResult: false }, false);
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
  });

  it('предмет закрыт годовой — только чтение', () => {
    renderTable({ finalGrade: publishedVna, yearLocked: true, canEditResult: false, canChangeAttestation: false });

    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByText('ВНА')).toBeInTheDocument();
    expect(screen.getByLabelText('Предмет закрыт за год')).toBeInTheDocument();
  });

  it('история с изменениями помечена числом событий', () => {
    renderTable({ finalGrade: vnaPendingSeven, historyCount: 3 });
    expect(screen.getByRole('button', { name: 'История итога — событий: 3' })).toBeInTheDocument();
  });

  it('техисправление — только у числа без ожидающего изменения', () => {
    const corrections = (row: Record<string, unknown>) => {
      const data = finals(row);
      (data as { canCorrectTechnicalErrors?: boolean }).canCorrectTechnicalErrors = true;
      const { unmount } = render(
        <QuarterFinalsTable finals={data} highlighted={new Set()} busyStudentId={null} onPick={vi.fn()} />,
      );
      const found = screen.queryByRole('button', { name: 'Исправить техническую ошибку' }) != null;
      unmount();
      return found;
    };

    expect(corrections({ finalGrade: published, canEditResult: false })).toBe(true);
    expect(corrections({ finalGrade: publishedVna, canEditResult: false })).toBe(false);
    expect(corrections({
      finalGrade: { ...published, publicationState: 'CHANGED_AFTER_PUBLICATION', pendingChange: { resultKind: 'TEMP_UNATTESTED' } },
      canEditResult: false,
    })).toBe(false);
  });

  it('D-1: правка ожидающего числа поверх опубликованного ВНА — через окно с причиной', async () => {
    const { onPick, onRequestStatus } = renderTable({ finalGrade: vnaPendingSeven, canConfirmPublication: true });

    await userEvent.click(screen.getByRole('button', { name: '8' }));

    expect(onRequestStatus).toHaveBeenCalledWith(expect.anything(), { kind: 'NUMERIC', value: 8 });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('D-1: у администрации то же — окно, а не учительский адрес', async () => {
    const { onPick, onRequestStatus } = renderTable(
      { finalGrade: vnaPendingSeven, canEditResult: false, canConfirmPublication: false }, false);

    await userEvent.click(screen.getByRole('button', { name: '8' }));

    expect(onRequestStatus).toHaveBeenCalledWith(expect.anything(), { kind: 'NUMERIC', value: 8 });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('D-2: выбранный «Не изучался» выглядит выбранным', () => {
    renderTable({ finalGrade: { id: 9, status: 'DRAFT', value: null, resultKind: 'NOT_STUDIED', publicationState: 'DRAFT' } });

    const chosen = screen.getByRole('button', { name: 'Не изучался' });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(chosen.className).toContain('bg-navy-700');
  });

  it('D-3: отказ действия виден под строкой ученика', () => {
    render(
      <QuarterFinalsTable
        finals={finals({})}
        highlighted={new Set()}
        busyStudentId={null}
        onPick={vi.fn()}
        rowError={{ studentProfileId: 1, message: 'Укажите причину — от 5 до 1000 символов' }}
      />,
    );
    const row = screen.getByText('Айдар Нурланов').closest('tr')!;
    expect(within(row).getByRole('alert')).toHaveTextContent('Укажите причину');
  });

  it('«Не изучался» — только пока итог не опубликован', () => {
    renderTable({});
    expect(screen.getByRole('button', { name: 'Не изучался' })).toBeInTheDocument();
  });
});
