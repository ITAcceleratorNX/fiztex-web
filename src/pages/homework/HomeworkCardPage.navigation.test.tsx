import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { homeworkApi } from '@/lib/homeworkApi';
import { HomeworkCardPage } from './HomeworkCardPage';
import { WorkspaceCollectionPage } from '@/pages/workspace/WorkspaceCollectionPage';

vi.mock('@/lib/homeworkApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/homeworkApi')>();
  return { ...actual, homeworkApi: {
    ...actual.homeworkApi,
    card: vi.fn().mockImplementation((id: number) => Promise.resolve({ id, title: id === 42 ? 'Контрольная работа' : 'Копия контрольной', subjectId: 3, status: 'DRAFT', answerFormat: 'TEXT', dueType: 'NONE' })),
    listMaterials: vi.fn().mockResolvedValue([]),
    copyToLesson: vi.fn().mockResolvedValue({ id: 99, title: 'Копия контрольной', status: 'DRAFT', answerFormat: 'TEXT', dueType: 'NONE' }),
  } };
});

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return { ...actual,
    useHomeworkAiJobs: () => ({ data: [] }),
    useApplyHomeworkAiResult: () => ({ isPending: false }),
    useDiscardHomeworkAiResult: () => ({ isPending: false }),
    useWorkspaceLessonTargets: () => ({ data: { content: [{ id: 8, subjectId: 3, subjectName: 'Физика', className: '7Б', academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] }], totalPages: 1 }, isPending: false, isError: false }),
  };
});

vi.mock('./HomeworkAiGenerateModal', () => ({ HomeworkAiGenerateModal: () => null }));
vi.mock('./HomeworkAiCompareModal', () => ({ HomeworkAiCompareModal: () => null }));

vi.mock('@/lib/teacherWorkspaceApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teacherWorkspaceApi')>();
  return { ...actual, teacherWorkspaceApi: { ...actual.teacherWorkspaceApi,
    section: vi.fn().mockResolvedValue({ section: { title: 'Домашние задания' } }),
    folder: vi.fn().mockResolvedValue({ folder: { id: 7, name: 'Мой класс' } }),
    folders: vi.fn().mockResolvedValue({ content: [] }),
    search: vi.fn().mockResolvedValue({ items: { content: [{ id: 81, sourceId: '42', sourceKind: 'teacher-homework', type: 'HOMEWORK', title: 'Контрольная работа' }], totalElements: 1 } }),
  } };
});

function CurrentUrl() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname + location.search}</output>;
}

function renderCard(returnTo: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>
    <ToastProvider>
      <MemoryRouter initialEntries={[`/homework/42?${new URLSearchParams({ returnTo })}`]}>
        <CurrentUrl />
        <Routes>
          <Route path="/homework/:homeworkId" element={<HomeworkCardPage />} />
          <Route path="/workspace/sections/HOMEWORK" element={<p>Раздел рабочего пространства</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  </QueryClientProvider>);
}

describe('Карточка ДЗ из рабочего пространства', () => {
  it('отделяет удаление от основных действий и сохраняет подтверждение', async () => {
    renderCard('/workspace/sections/HOMEWORK');
    await screen.findByRole('heading', { name: 'Контрольная работа' });
    expect(screen.queryByRole('button', { name: 'Удалить черновик' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Другие действия с заданием' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить черновик' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Контрольная работа' })).toBeInTheDocument();
  });

  it('показывает путь и возвращает в тот же раздел на ту же страницу', async () => {
    renderCard('/workspace/sections/HOMEWORK?page=2');
    await screen.findByRole('heading', { name: 'Контрольная работа' });

    const breadcrumbs = screen.getByRole('navigation', { name: 'Навигационная цепочка' });
    expect(within(breadcrumbs).getByRole('link', { name: 'Рабочее пространство' })).toHaveAttribute('href', '/workspace');
    expect(within(breadcrumbs).getByRole('link', { name: 'Домашние задания' }))
      .toHaveAttribute('href', '/workspace/sections/HOMEWORK?page=2');
    expect(within(breadcrumbs).getByText('Контрольная работа')).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByRole('link', { name: 'К разделу «Домашние задания»' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/workspace/sections/HOMEWORK?page=2');
    expect(screen.getByText('Раздел рабочего пространства')).toBeInTheDocument();
  });

  it('после копирования сохраняет возврат из новой карточки в исходный раздел', async () => {
    renderCard('/workspace/sections/HOMEWORK?page=2');
    await userEvent.click(await screen.findByRole('button', { name: 'Скопировать в другой урок' }));
    await userEvent.click(await screen.findByRole('button', { name: /Физика · 7Б/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Срок сдачи копии' }));
    await userEvent.click(screen.getByRole('option', { name: 'Без срока' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await screen.findByRole('heading', { name: 'Копия контрольной' });
    expect(homeworkApi.copyToLesson).toHaveBeenCalledWith(42, { lessonId: 8, dueType: 'NONE', confirmRecipients: true }, expect.any(String));
    expect(screen.getByTestId('url')).toHaveTextContent(`/homework/99?${new URLSearchParams({ returnTo: '/workspace/sections/HOMEWORK?page=2' })}`);
    await userEvent.click(screen.getByRole('link', { name: 'К разделу «Домашние задания»' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/workspace/sections/HOMEWORK?page=2');
  });

  it.each(['/workspace/sections/HOMEWORK?page=2', '/workspace/folders/7?page=1'])('копирует из меню материала и сохраняет путь %s', async (path) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[path]}>
      <CurrentUrl />
      <Routes>
        <Route path="/workspace/sections/:sectionCode" element={<WorkspaceCollectionPage kind="section" />} />
        <Route path="/workspace/folders/:folderId" element={<WorkspaceCollectionPage kind="folder" />} />
        <Route path="/homework/:homeworkId" element={<HomeworkCardPage />} />
      </Routes>
    </MemoryRouter></ToastProvider></QueryClientProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Действия: Контрольная работа' }));
    await userEvent.click(screen.getByRole('button', { name: 'Скопировать в другой урок' }));
    await userEvent.click(await screen.findByRole('button', { name: /Физика · 7Б/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Срок сдачи копии' }));
    await userEvent.click(screen.getByRole('option', { name: 'Без срока' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await screen.findByRole('heading', { name: 'Копия контрольной' });
    expect(screen.getByTestId('url')).toHaveTextContent(`/homework/99?${new URLSearchParams({ returnTo: path })}`);
    const breadcrumbs = screen.getByRole('navigation', { name: 'Навигационная цепочка' });
    expect(within(breadcrumbs).getByRole('link', { name: path.includes('folders') ? 'Личная папка' : 'Домашние задания' })).toHaveAttribute('href', path);
  });
});
