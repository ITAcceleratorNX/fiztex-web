import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GradeHistoryDialog } from './GradeHistoryDialog';
import { gradesApi } from '@/lib/gradesApi';
import { ApiError } from '@/lib/api';
import { gradeHistoryActor, gradeHistoryDescription } from '@/lib/gradeHistoryModel';

vi.mock('@/lib/gradesApi', () => ({ gradesApi: { history: vi.fn() } }));
const history = vi.mocked(gradesApi.history);
function open(gradeId = 11) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <GradeHistoryDialog gradeId={gradeId} studentName="Болатбек Дана" onClose={() => undefined} />
  </QueryClientProvider>);
}
const events = [
  { id: 1, action: 'UPDATE' as const, before: { score: 8, maxScore: 10 }, after: { score: 10, maxScore: 10 }, actorName: 'Учитель А', actorCapacity: 'SUBSTITUTE_TEACHER' as const, createdAt: '2026-10-14T10:00:00Z' },
  { id: 2, action: 'UPDATE' as const, before: { score: 10, maxScore: 10 }, after: { score: 8, maxScore: 10 }, actorName: 'Учитель Б', actorCapacity: 'MAIN_TEACHER' as const, createdAt: '2026-10-14T10:01:00Z' },
];

describe('GradeHistoryDialog', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows both changes with their own authors and timestamps in server order', async () => {
    history.mockResolvedValue(events);
    open();
    const list = await screen.findByRole('list', { name: 'Изменения оценки' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('8 → 10');
    expect(rows[0]).toHaveTextContent('Учитель А · Замещающий учитель');
    expect(rows[1]).toHaveTextContent('10 → 8');
    expect(rows[1]).toHaveTextContent('Учитель Б · Основной учитель');
    expect(rows[0].querySelector('time')).toHaveAttribute('datetime', events[0].createdAt);
    expect(history).toHaveBeenCalledWith(11, expect.any(AbortSignal));
  });
  it('refetches history after reopening without creating local events', async () => {
    history.mockResolvedValue(events);
    const first = open();
    await screen.findByText('8 → 10');
    first.unmount();
    open();
    await screen.findByText('10 → 8');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(history).toHaveBeenCalledTimes(2);
  });
  it('has an empty state and can retry an access error', async () => {
    history.mockRejectedValueOnce(new ApiError(403, 'Нет доступа')).mockResolvedValueOnce([]);
    open();
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Не удалось загрузить историю оценки');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('История пуста');
  });
  it('supports old snapshots, system actors and type changes', () => {
    expect(gradeHistoryDescription({ action: 'CREATE', after: { scaleCode: '4+' } })).toBe('Выставлена оценка 4+');
    expect(gradeHistoryDescription({ action: 'DELETE', before: { score: 0, maxScore: 20 } })).toBe('Снята оценка 0/20');
    expect(gradeHistoryActor({})).toBe('Система');
    expect(gradeHistoryActor({ actorId: 7 })).toBe('Пользователь #7');
    expect(gradeHistoryDescription({ action: 'UPDATE', before: { score: 8, gradeType: 'FORMATIVE' }, after: { score: 8, gradeType: 'ORAL_ANSWER' } })).toContain('Вид работы:');
  });
});
