import { render as baseRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiReport } from '@/lib/aiReportModel';
import { AiReportDrawer } from './AiReportDrawer';

const mutation = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null });
let commands: Record<string, ReturnType<typeof mutation>>;
let detail: AiReport;
const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, isSuccess: true, error: null, refetch: vi.fn() });

vi.mock('@/hooks/aiReportQueries', () => ({
  useAiReport: () => ok(detail),
  useAiReportHistory: () => ok([]),
  useAiReportVersion: () => ok(undefined),
  useAiReportJob: () => ok(undefined),
  useAiReportCommands: () => commands,
  useAiReportContext: () => ok(undefined),
  useCreateAiReport: () => mutation(),
  newIdempotencyKey: () => 'key',
}));

const render = (ui: ReactElement) => baseRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const TEXT = 'Результаты и достижения\n• Средний балл 7,9.\n\nРекомендации учителю\n• Повторить тему.';

function report(overrides: Partial<AiReport> = {}): AiReport {
  return {
    report: { id: 1, owner: 'SUBJECT_TEACHER', type: 'STUDENT', state: 'DRAFT', published: false, withdrawn: false,
      student: { id: 80, name: 'Ахметов Ерлан' }, classes: [{ id: 5, name: '7А' }], subject: { id: 1, name: 'Математика' },
      period: { kind: 'ACADEMIC_PERIOD', label: '2 четверть', from: '2026-11-03', to: '2026-11-27' } },
    current: { id: 11, number: 1, status: 'DRAFT', revision: 3, teacherText: TEXT, parentSuggestion: 'Достижения\nХорошо.',
      facts: [{ code: 'AVERAGE', label: 'Ср. балл', value: '7,9' }] },
    versions: [{ id: 11, number: 1, status: 'DRAFT' }],
    parentPublicationEnabled: true,
    actions: { canRegenerate: true, canEdit: true, canApprove: true, canEditParentSummary: false,
      canConfirmParentSummary: false, canPublish: false, canUnpublish: false },
    ...overrides,
  } as AiReport;
}

beforeEach(() => {
  commands = Object.fromEntries(['saveText', 'approve', 'saveParent', 'confirmParent', 'publish', 'unpublish', 'regenerate']
    .map((name) => [name, mutation()]));
});

describe('AiReportDrawer', () => {
  it('показывает факты из журнала и отделяет рекомендации AI', () => {
    detail = report();
    render(<AiReportDrawer reader="teacher" target={{ kind: 'report', reportId: 1 }} onClose={vi.fn()} />);
    expect(screen.getByText('Данные за период — из журнала')).toBeInTheDocument();
    expect(screen.getByText('7,9')).toBeInTheDocument();
    expect(screen.getByText('Предложение AI — проверьте перед утверждением')).toBeInTheDocument();
  });

  it('утверждает только после отметки «Я проверил(а)» и с ревизией версии', async () => {
    detail = report();
    render(<AiReportDrawer reader="teacher" target={{ kind: 'report', reportId: 1 }} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Утвердить' }));
    const confirm = screen.getByRole('button', { name: 'Утвердить' });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(confirm);
    expect(commands.approve.mutate).toHaveBeenCalledWith({ versionId: 11, revision: 3 }, expect.anything());
  });

  it('публикация родителям закрыта, пока текст для родителя не утверждён', async () => {
    detail = report({
      current: { ...report().current!, status: 'APPROVED', approvedAt: '2026-11-27T10:00:00Z' },
      report: { ...report().report!, state: 'APPROVED' },
      actions: { canRegenerate: true, canEdit: true, canApprove: false, canEditParentSummary: true,
        canConfirmParentSummary: false, canPublish: false, canUnpublish: false },
    });
    render(<AiReportDrawer reader="teacher" target={{ kind: 'report', reportId: 1 }} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Для родителя' }));
    expect(screen.getByRole('button', { name: 'Опубликовать родителям' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Утвердить текст' }));
    expect(commands.saveParent.mutate).toHaveBeenCalledWith({ text: 'Достижения\nХорошо.', revision: undefined }, expect.anything());
  });

  it('администрация только читает: ни правки, ни утверждения, ни публикации', () => {
    detail = report({
      current: { ...report().current!, status: 'APPROVED' },
      report: { ...report().report!, state: 'PUBLISHED', published: true },
      parentSummary: { id: 5, status: 'CONFIRMED', text: 'Достижения\nХорошо.', outdated: false },
      publication: { id: 9, parentSummaryId: 5, active: true },
      actions: { canRegenerate: false, canEdit: false, canApprove: false, canEditParentSummary: false,
        canConfirmParentSummary: false, canPublish: false, canUnpublish: false },
    });
    render(<AiReportDrawer reader="admin" target={{ kind: 'report', reportId: 1 }} onClose={vi.fn()} />);
    expect(screen.getByText(/Просмотр: утверждённый текст/)).toBeInTheDocument();
    for (const name of ['Редактировать', 'Утвердить', 'Новая версия', 'Опубликовать родителям', 'Снять публикацию']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Для родителя' })).toBeInTheDocument();
  });
});
