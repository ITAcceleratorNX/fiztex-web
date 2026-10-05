import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { teacherWorkspaceApi } from '@/lib/teacherWorkspaceApi';
import { WorkspaceHomePage } from './WorkspaceHomePage';

vi.mock('@/lib/teacherWorkspaceApi', async (original) => {
  const actual = await original<typeof import('@/lib/teacherWorkspaceApi')>();
  return { ...actual, teacherWorkspaceApi: { ...actual.teacherWorkspaceApi, home: vi.fn(), search: vi.fn() } };
});

function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(url = '/workspace') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[url]}>
    <Location /><WorkspaceHomePage />
  </MemoryRouter></ToastProvider></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(teacherWorkspaceApi.home).mockReset().mockResolvedValue({
    sections: [{ code: 'HOMEWORK', title: 'Домашние задания' }], folders: { content: [] },
  });
  vi.mocked(teacherWorkspaceApi.search).mockReset().mockResolvedValue({ items: { content: [], totalElements: 0 } });
});

describe('Поиск в рабочем пространстве', () => {
  it('показывает подписи фильтров и сбрасывает поиск с возвратом к разделам', async () => {
    renderPage('/workspace?q=Ньютон&type=DOCUMENT&fileType=PDF&page=2&folderPage=1');
    expect(screen.getByLabelText('Поиск по материалам')).toHaveValue('Ньютон');
    expect(screen.getByRole('button', { name: 'Тип материала' })).toHaveTextContent('Документы и материалы');
    expect(screen.getByRole('button', { name: 'Тип файла' })).toHaveTextContent('PDF');
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
    expect(await screen.findByRole('heading', { name: 'Разделы' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?folderPage=1');
    expect(screen.getByLabelText('Поиск по материалам')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Тип файла' })).not.toBeInTheDocument();
    expect(screen.getByText('Пока нет папок')).toBeInTheDocument();
  });

  it('сохраняет выбранный фильтр при ошибке и позволяет повторить поиск', async () => {
    vi.mocked(teacherWorkspaceApi.search).mockRejectedValueOnce(new Error('Offline'));
    renderPage();
    const filter = screen.getByRole('button', { name: 'Тип материала' });
    filter.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(screen.getByRole('option', { name: 'Домашние задания' }));
    expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(filter).toHaveTextContent('Домашние задания');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    await waitFor(() => expect(teacherWorkspaceApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOMEWORK', page: 0 }), expect.anything(),
    ));
  });
});
