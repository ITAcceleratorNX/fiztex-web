import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuarterFinalsTable, type QuarterFinalsActions } from './QuarterFinalsTable';

type Finals = Parameters<typeof QuarterFinalsTable>[0]['finals'];

function finals(row: Record<string, unknown>, extra: Record<string, unknown> = {}): Finals {
  return {
    canManage: true,
    canManageAttestation: true,
    gradingPolicy: { policyId: 1 },
    allowedValues: [2, 3, 4, 5],
    positiveValues: [3, 4, 5],
    allowedResultKinds: ['NUMERIC', 'TEMP_UNATTESTED', 'NOT_ATTESTED', 'NOT_STUDIED'],
    assessmentMode: 'NUMERIC',
    rows: [{
      studentProfileId: 1, studentName: 'Ахметов Нурсултан', currentMember: true,
      canEditResult: true, canChangeAttestation: true, canConfirmPublication: false,
      canCorrectTechnicalError: false, historyCount: 1,
      ...row,
    }],
    ...extra,
  } as unknown as Finals;
}

const draftFour = { id: 4, status: 'DRAFT', value: 4, resultKind: 'NUMERIC', version: 1 };
const draftVna = { id: 5, status: 'DRAFT', value: null, resultKind: 'TEMP_UNATTESTED', resultReason: 'Не сдан СОЧ', version: 1 };
const publishedFour = { id: 6, status: 'PUBLISHED', value: 4, resultKind: 'NUMERIC', version: 2 };
const publishedVna = { id: 7, status: 'PUBLISHED', value: null, resultKind: 'TEMP_UNATTESTED', resultReason: 'Не сдан СОЧ', version: 2 };
const publishedNa = {
  id: 8, status: 'PUBLISHED', value: null, resultKind: 'NOT_ATTESTED',
  resultReason: 'Пропущено больше половины уроков, работы не сданы', version: 2,
};

function renderTable(row: Record<string, unknown>, options: { editMode?: boolean; extra?: Record<string, unknown> } = {}) {
  const actions: QuarterFinalsActions = {
    onPickValue: vi.fn(), onPickResult: vi.fn(), onRequestStatus: vi.fn(), onRequestChange: vi.fn(),
    onOpenHistory: vi.fn(), onCorrect: vi.fn(), onRepublish: vi.fn(),
  };
  render(
    <QuarterFinalsTable finals={finals(row, options.extra)} highlighted={new Set()} busyStudentId={null}
      editMode={options.editMode} actions={actions} />,
  );
  return actions;
}

describe('итоги четверти до публикации (макет Т1–Т4)', () => {
  it('оценка и аттестация — разные колонки, число сохраняется сразу', async () => {
    const actions = renderTable({ finalGrade: draftFour });

    expect(screen.getByRole('columnheader', { name: 'Аттестация' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: '4' }));

    expect(actions.onPickValue).toHaveBeenCalledTimes(1);
    expect(actions.onPickValue).toHaveBeenCalledWith(expect.objectContaining({ studentProfileId: 1 }), 5);
  });

  it('ВНА/НА, которого нет в строке, открывает окно статуса — а не сохраняет', async () => {
    const actions = renderTable({ finalGrade: draftFour });

    await userEvent.click(screen.getByRole('button', { name: 'Не аттестован' }));

    expect(actions.onRequestStatus).toHaveBeenCalledWith(expect.anything(), 'NOT_ATTESTED');
    expect(actions.onPickValue).not.toHaveBeenCalled();
  });

  it('у строки со статусом в колонке оценки прочерк; нажатие по статусу — «Изменить итог»', async () => {
    const actions = renderTable({ finalGrade: draftVna, historyCount: 1 });

    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    const vna = screen.getByRole('button', { name: 'Временно не аттестован' });
    expect(vna).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(vna);

    expect(actions.onRequestChange).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('значок причины показывает её под курсором, значок истории — у строки со статусом', async () => {
    const actions = renderTable({ finalGrade: draftVna });

    await userEvent.hover(screen.getByRole('button', { name: 'Причина статуса' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Причина временно не аттестован');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Не сдан СОЧ');
    await userEvent.click(screen.getByRole('button', { name: 'История итога' }));
    expect(actions.onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('«…» — особые результаты без числа через окно «Изменить итог»', async () => {
    const actions = renderTable({ finalGrade: draftFour });

    await userEvent.click(screen.getByRole('button', { name: /Другой результат/ }));

    expect(actions.onRequestChange).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('отказ действия виден под строкой ученика (D-3)', () => {
    render(
      <QuarterFinalsTable finals={finals({ finalGrade: draftFour })} highlighted={new Set()} busyStudentId={null}
        rowError={{ studentProfileId: 1, message: 'Сервер не ответил' }}
        actions={{ onPickValue: vi.fn(), onPickResult: vi.fn(), onRequestStatus: vi.fn(), onRequestChange: vi.fn(),
          onOpenHistory: vi.fn(), onCorrect: vi.fn(), onRepublish: vi.fn() }} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Сервер не ответил');
  });
});

describe('после публикации (макет Т5–Т7а)', () => {
  it('опубликованное число — под замком, без выбора', () => {
    renderTable({ finalGrade: publishedFour, canEditResult: false, canChangeAttestation: false, historyCount: 2 });

    expect(screen.queryByRole('button', { name: '5' })).toBeNull();
    expect(screen.getByLabelText('Итог закрыт для правки')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'История итога' })).toBeNull();
  });

  it('опубликованный ВНА вне режима изменения — плашка и прочерк', () => {
    renderTable({ finalGrade: publishedVna, canEditResult: true, canChangeAttestation: false, historyCount: 2 });

    expect(screen.getByText('ВНА')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
  });

  it('в режиме изменения у ВНА — только положительные оценки, каждая открывает «Изменить итог»', async () => {
    const actions = renderTable(
      { finalGrade: publishedVna, canEditResult: true, canChangeAttestation: false, historyCount: 2 },
      { editMode: true },
    );

    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '4' }));

    expect(actions.onRequestChange).toHaveBeenCalledWith(expect.anything(), { kind: 'NUMERIC', value: 4 });
    expect(actions.onPickValue).not.toHaveBeenCalled();
  });

  it('опубликованный НА у учителя под замком — исправляет администратор', () => {
    renderTable({ finalGrade: publishedNa, canEditResult: false, canChangeAttestation: false, historyCount: 2 }, { editMode: true });

    expect(screen.getByText('НА')).toBeInTheDocument();
    expect(screen.getByLabelText('Исправляет администратор')).toBeInTheDocument();
  });

  it('ВНА сняли оценкой — значок истории остаётся (Т7а)', () => {
    renderTable({ finalGrade: { ...publishedFour, id: 9 }, canEditResult: false, canChangeAttestation: false, historyCount: 3 });

    expect(screen.getByRole('button', { name: 'История итога' })).toBeInTheDocument();
  });

  it('рекомендация разошлась с опубликованным числом — подтверждение по кнопке (ТЗ №9)', async () => {
    const actions = renderTable({
      finalGrade: publishedFour, canEditResult: false, canChangeAttestation: false,
      recommendedValue: 5, recommendationChanged: true, canConfirmPublication: true,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить и опубликовать' }));
    expect(actions.onRepublish).toHaveBeenCalledTimes(1);
  });
});

describe('администрация (макет А0)', () => {
  it('ничего не выставляет, у опубликованного — «Исправить»', async () => {
    const actions = renderTable(
      { finalGrade: publishedNa, canEditResult: false, canChangeAttestation: false, canCorrectTechnicalError: true, historyCount: 2 },
      { extra: { canManage: false, canManageAttestation: false } },
    );

    expect(screen.queryByRole('button', { name: 'Временно не аттестован' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Исправить' }));
    expect(actions.onCorrect).toHaveBeenCalledWith(expect.objectContaining({ studentProfileId: 1 }));
  });

  it('у черновика «Исправить» нет — его меняет учитель', () => {
    renderTable(
      { finalGrade: draftVna, canEditResult: false, canChangeAttestation: false, canCorrectTechnicalError: false },
      { extra: { canManage: false, canManageAttestation: false } },
    );

    expect(screen.queryByRole('button', { name: 'Исправить' })).toBeNull();
  });
});

describe('процент и рекомендация', () => {
  it('до СОЧ показатель помечен «Предварительно», а не выдан за итог', () => {
    renderTable({
      result: { status: 'CALCULATED', percent: 80, roundedPercent: 80, recommendedValue: 4, missingComponents: ['SOCH'] },
      recommendedValue: 4,
    });
    expect(screen.getByText('Предварительно')).toBeInTheDocument();
    expect(screen.getByText('без СОЧ')).toBeInTheDocument();
  });

  it('нехватка данных — причина словами, а не процент', () => {
    renderTable({ result: { status: 'INCOMPLETE', missingComponents: ['SOCH'] }, recommendedValue: null });
    expect(screen.getByText('Нет СОЧ')).toBeInTheDocument();
    expect(screen.queryByText('0%')).toBeNull();
  });
});
