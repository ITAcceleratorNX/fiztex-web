import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonSummary } from '@/lib/lessonSummaryApi';
import { LessonSummaryPage } from './LessonSummaryPage';

const query = vi.fn();
const save = vi.fn();
const publish = vi.fn();
const unpublish = vi.fn();
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('./LessonSummaryGenerateModal', () => ({ LessonSummaryGenerateModal: () => null }));
vi.mock('@/hooks/queries', () => ({
  useLesson: () => ({ data: { id: 1, topic: 'Плотность', subjectName: 'Физика' } }),
  useLessonSummary: () => query(),
  useSummaryCommands: () => ({
    save: { mutateAsync: save }, publish: { mutateAsync: publish }, unpublish: { mutateAsync: unpublish },
  }),
}));
const content = { title: 'Плотность', summaryText: 'Конспект', companionText: 'План ученику', companionKind: 'PLAN' as const };
let data: LessonSummary;
function Page() {
  return <MemoryRouter initialEntries={['/lesson-schedule/lessons/1/summary']}><Routes>
    <Route path="/lesson-schedule/lessons/:lessonId/summary" element={<LessonSummaryPage />} />
  </Routes></MemoryRouter>;
}
describe('Конспект урока', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data = { canEdit: true, revision: 4, content, hasUnpublishedChanges: true };
    query.mockImplementation(() => ({ data }));
    save.mockResolvedValue({ ...data, revision: 5 });
    publish.mockResolvedValue({ ...data, revision: 6, publishedAt: '2026-09-24', publishedContent: content });
  });
  it('сохраняет ручные правки при обновлении после генерации и показывает конфликт', async () => {
    const user = userEvent.setup();
    const view = render(<Page />);
    await user.type(screen.getByLabelText('Краткий конспект'), ' — моя правка');
    data = { ...data, revision: 5, content: { ...content, summaryText: 'Ответ ИИ' } };
    view.rerender(<Page />);
    expect(screen.getByLabelText('Краткий конспект')).toHaveValue('Конспект — моя правка');
    expect(screen.getByText(/На сервере появилась новая версия/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Сохранить черновик' })).toBeDisabled();
  });
  it('публикует именно сохранённую новую версию с обоими блоками', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.type(screen.getByLabelText('Краткий конспект'), ' +');
    await user.click(screen.getByRole('button', { name: 'Опубликовать оба блока' }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(5));
    expect(save).toHaveBeenCalledWith({ revision: 4, content: { ...content, summaryText: 'Конспект +' } });
  });
  it('при ошибке сохранения оставляет введённый текст и не публикует', async () => {
    const user = userEvent.setup();
    save.mockRejectedValue(new Error('offline'));
    render(<Page />);
    await user.type(screen.getByLabelText('Текст второго блока'), ' +');
    await user.click(screen.getByRole('button', { name: 'Опубликовать оба блока' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Текст второго блока')).toHaveValue('План ученику +');
    expect(publish).not.toHaveBeenCalled();
  });
  it('читателю показывает оба опубликованных блока, включая план, без редактора', () => {
    data = { canEdit: false, content, publishedAt: '2026-09-24' };
    render(<Page />);
    expect(screen.getByText('План ученику')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Краткий конспект' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'План урока' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Опубликовать/ })).not.toBeInTheDocument();
  });
  it('позволяет просмотреть результат ИИ, который не затёр ручную версию', async () => {
    const user = userEvent.setup();
    data = { ...data, latestJob: { status: 'DONE', applied: false, result: { ...content, summaryText: 'Отдельный результат' } } };
    render(<Page />);
    expect(screen.getByLabelText('Краткий конспект')).toHaveValue('Конспект');
    await user.click(screen.getByRole('button', { name: 'Посмотреть результат' }));
    await user.click(screen.getByRole('button', { name: 'Использовать как черновик' }));
    expect(screen.getByLabelText('Краткий конспект')).toHaveValue('Отдельный результат');
    expect(save).not.toHaveBeenCalled();
  });
});
