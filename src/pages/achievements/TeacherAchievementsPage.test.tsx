import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { achievementsApi, type TeacherAchievement } from '@/lib/achievementsApi';
import { TeacherAchievementsPage } from './TeacherAchievementsPage';

const list = vi.spyOn(achievementsApi, 'list');
const audience = vi.spyOn(achievementsApi, 'audienceOptions');
const create = vi.spyOn(achievementsApi, 'create');
const visibility = vi.spyOn(achievementsApi, 'updateVisibility');
const remove = vi.spyOn(achievementsApi, 'remove');
afterEach(() => vi.clearAllMocks());

const doc = (patch: Partial<TeacherAchievement> = {}): TeacherAchievement => ({
  id: 1, title: 'Диплом победителя', categoryLabel: 'Диплом', category: 'DIPLOMA', receivedOn: '2026-05-20',
  fileName: 'diploma.pdf', sizeBytes: 2048, visibility: 'PRIVATE', classes: [], visibleToParents: false, ...patch,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter>
    <TeacherAchievementsPage />
  </MemoryRouter></ToastProvider></QueryClientProvider>);
}

describe('TeacherAchievementsPage', () => {
  it('пустой раздел предлагает добавить документ', async () => {
    list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Достижений пока нет')).toBeInTheDocument();
  });

  it('новое достижение уходит с файлом и полями и показывается закрытым', async () => {
    list.mockResolvedValue([]);
    create.mockImplementation(async (_file, _fields, onProgress) => { onProgress?.(1); return doc(); });
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Добавить достижение' }))[0]);
    const dialog = await screen.findByRole('dialog');
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['%PDF-1.4'], 'Диплом_победителя.pdf', { type: 'application/pdf' }));
    expect(within(dialog).getByDisplayValue('Диплом победителя')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][1]).toEqual(expect.objectContaining({ title: 'Диплом победителя', organization: undefined }));
    expect(await screen.findByText('Только я')).toBeInTheDocument();
  });

  it('ошибка сохранения оставляет форму заполненной и даёт повторить', async () => {
    list.mockResolvedValue([]);
    create.mockRejectedValueOnce(new ApiError(400, 'Достижение загружается только в PDF.', 'ACHIEVEMENT_FILE_NOT_PDF'));
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Добавить достижение' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'scan.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByText('Достижение загружается только в PDF.')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('scan')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('выбранные классы без отметок не публикуются', async () => {
    list.mockResolvedValue([doc()]);
    audience.mockResolvedValue({ classes: [{ id: 5, name: '7А', active: true }] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Доступ' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByText('Выбранные классы'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByText('Выберите хотя бы один класс')).toBeInTheDocument();
    expect(visibility).not.toHaveBeenCalled();
  });

  it('удаление спрашивает подтверждение', async () => {
    list.mockResolvedValue([doc({ visibility: 'ALL_CLASSES', visibleToParents: true, classes: [{ id: 5, name: '7А', active: true }] })]);
    remove.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText('Все мои классы')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    const dialog = await screen.findByRole('dialog');
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
  });
});
