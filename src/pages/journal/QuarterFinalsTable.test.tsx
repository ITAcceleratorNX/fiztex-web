import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuarterFinalsTable, needsRepublish } from './QuarterFinalsTable';

type Finals = Parameters<typeof QuarterFinalsTable>[0]['finals'];

function finals(row: Record<string, unknown>, canManage = true): Finals {
  return {
    canManage,
    gradingPolicy: { policyId: 1 },
    allowedValues: [2, 3, 4, 5],
    assessmentMode: 'NUMERIC',
    rows: [{ studentProfileId: 1, studentName: 'Айдар Нурланов', currentMember: true, ...row }],
  } as unknown as Finals;
}

const published = { id: 5, status: 'PUBLISHED', value: 4, resultKind: 'NUMERIC', version: 2 };

function renderTable(row: Record<string, unknown>, canManage = true, onRepublish = vi.fn()) {
  render(
    <QuarterFinalsTable
      finals={finals(row, canManage)}
      highlighted={new Set()}
      busyStudentId={null}
      onPick={vi.fn()}
      onRepublish={onRepublish}
    />,
  );
  return onRepublish;
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
    const onRepublish = renderTable({
      result: { status: 'CALCULATED', percent: 90, recommendedValue: 5, missingComponents: [] },
      recommendedValue: 5, finalGrade: published, recommendationChanged: true,
    });
    expect(screen.getByText(/Требуется повторное подтверждение/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить и опубликовать' }));
    expect(onRepublish).toHaveBeenCalledTimes(1);
  });

  it('без изменения рекомендации и без права кнопки нет', () => {
    renderTable({ recommendedValue: 4, finalGrade: published, recommendationChanged: false });
    expect(screen.queryByRole('button', { name: 'Подтвердить и опубликовать' })).toBeNull();
  });

  it('правило кнопки: нужен учитель, опубликованный числовой итог и свежая рекомендация', () => {
    const row = { recommendedValue: 5, finalGrade: published, recommendationChanged: true, currentMember: true } as never;
    expect(needsRepublish(row, true)).toBe(true);
    expect(needsRepublish(row, false)).toBe(false);
    expect(needsRepublish({ ...(row as object), finalGrade: { ...published, status: 'DRAFT' } } as never, true)).toBe(false);
    expect(needsRepublish({ ...(row as object), finalGrade: { ...published, resultKind: 'TEMP_UNATTESTED' } } as never, true)).toBe(false);
    expect(needsRepublish({ ...(row as object), yearLocked: true } as never, true)).toBe(false);
    expect(needsRepublish({ ...(row as object), recommendedValue: null } as never, true)).toBe(false);
  });
});
