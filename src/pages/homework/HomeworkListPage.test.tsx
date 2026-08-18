import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { HomeworkListPage } from './HomeworkListPage';

const list = vi.fn();

vi.mock('@/lib/homeworkApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/homeworkApi')>();
  return { ...actual, homeworkApi: { list: (...args: unknown[]) => list(...args) } };
});

function row(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Параграф 12, упражнения 1–5',
    status: 'PUBLISHED',
    dueType: 'EXACT',
    dueAt: '2026-10-18T15:00:00Z',
    overdue: false,
    classId: 7,
    className: '7А',
    subjectId: 3,
    subjectName: 'Математика',
    progress: { submitted: 12, total: 24, pendingReview: 3 },
    ...over,
  };
}

function page(content: unknown[]) {
  return { content, totalElements: content.length, totalPages: 1, size: 50, number: 0 };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomeworkListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Аргументы последнего запроса списка — то, что экран реально попросил у сервера. */
function lastQuery() {
  return list.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  list.mockReset();
});

describe('HomeworkListPage', () => {
  it('запрашивает вкладку «Актуальные» и печатает строку задания', async () => {
    list.mockResolvedValue(page([row()]));
    renderPage();

    expect(await screen.findByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
    expect(lastQuery().scope).toBe('ACTUAL');
    // Прогресс — «сдали / всего получателей» (ТЗ §4.2).
    expect(screen.getByText('12 / 24')).toBeInTheDocument();
    expect(screen.getByText('Опубликовано')).toBeInTheDocument();
  });

  it('переключение на «Историю» уходит в запрос, а не отбирается на клиенте', async () => {
    list.mockResolvedValue(page([row({ status: 'COMPLETED' })]));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');

    await userEvent.click(screen.getByRole('tab', { name: 'История' }));

    expect(lastQuery().scope).toBe('HISTORY');
  });

  it('фильтр статуса предлагает только статусы своей вкладки (§4.1)', async () => {
    list.mockResolvedValue(page([row()]));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');

    await userEvent.click(screen.getByRole('button', { name: /Статус/ }));
    const actual = screen.getByRole('listbox', { name: 'Статус' });
    expect(within(actual).getByRole('option', { name: 'Черновик' })).toBeInTheDocument();
    expect(within(actual).queryByRole('option', { name: 'Завершено' })).not.toBeInTheDocument();
  });

  it('несовместимый статус сбрасывается при смене вкладки, а не уходит в запрос', async () => {
    list.mockResolvedValue(page([row()]));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');

    await userEvent.click(screen.getByRole('button', { name: /Статус/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Черновик' }));
    expect(lastQuery().statuses).toEqual(['DRAFT']);

    await userEvent.click(screen.getByRole('tab', { name: 'История' }));

    expect(lastQuery().scope).toBe('HISTORY');
    expect(lastQuery().statuses).toBeUndefined();
  });

  it('фильтры комбинируются в одном запросе (§9.5)', async () => {
    list.mockResolvedValue(page([row()]));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');

    await userEvent.click(screen.getByRole('button', { name: /Класс/ }));
    await userEvent.click(screen.getByRole('option', { name: '7А' }));

    await userEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Есть работы на проверку' }));

    expect(lastQuery()).toMatchObject({ scope: 'ACTUAL', classId: 7, pendingReviewOnly: true });
  });

  it('пустая выдача под фильтрами предлагает сброс, а пустая вкладка — нет (§8)', async () => {
    // Варианты фильтра берутся из самих заданий, поэтому список сперва должен приехать
    // непустым — иначе выбирать в «Классе» было бы нечего.
    list.mockImplementation((params: Record<string, unknown>) =>
      Promise.resolve(page(params.classId ? [] : [row()])),
    );
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');

    await userEvent.click(screen.getByRole('button', { name: /Класс/ }));
    await userEvent.click(screen.getByRole('option', { name: '7А' }));

    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(await screen.findByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
  });

  it('пустая вкладка «Актуальные» не предлагает сброс — сбрасывать нечего (§8)', async () => {
    list.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('Нет актуальных заданий')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сбросить фильтры' })).not.toBeInTheDocument();
  });

  it('варианты фильтра не схлопываются после выбора класса', async () => {
    list.mockImplementation((params: Record<string, unknown>) =>
      Promise.resolve(
        page(
          params.classId === 7
            ? [row()]
            : [row(), row({ id: 2, classId: 9, className: '9Б', title: 'Лабораторная работа №3' })],
        ),
      ),
    );
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');

    await userEvent.click(screen.getByRole('button', { name: /Класс/ }));
    await userEvent.click(screen.getByRole('option', { name: '7А' }));

    // Выдача сузилась до одного класса, но переключиться на другой всё ещё можно:
    // иначе фильтр запирал бы сам себя.
    await userEvent.click(screen.getByRole('button', { name: /7А/ }));
    expect(screen.getByRole('option', { name: '9Б' })).toBeInTheDocument();
  });

  it('пустая «История» — своё состояние без предложения создать задание', async () => {
    list.mockResolvedValue(page([]));
    renderPage();
    await screen.findByText('Нет актуальных заданий');

    await userEvent.click(screen.getByRole('tab', { name: 'История' }));

    expect(await screen.findByText('В истории пока ничего нет')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Создать задание' })).not.toBeInTheDocument();
  });

  it('ошибка загрузки предлагает повтор и повторяет запрос (§8)', async () => {
    list.mockRejectedValue(new ApiError(500, 'boom'));
    renderPage();

    expect(await screen.findByText(/Не удалось загрузить задания/)).toBeInTheDocument();
    const before = list.mock.calls.length;

    list.mockResolvedValue(page([row()]));
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
    expect(list.mock.calls.length).toBeGreaterThan(before);
  });

  it('403 — это «нет доступа», а не сбой сети (§8)', async () => {
    list.mockRejectedValue(new ApiError(403, 'forbidden'));
    renderPage();

    expect(await screen.findByText('Раздел недоступен')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });

  it('просроченное задание помечено, но остаётся на «Актуальных» (§5)', async () => {
    list.mockResolvedValue(page([row({ overdue: true })]));
    renderPage();

    expect(await screen.findByText('Просрочено')).toBeInTheDocument();
    expect(lastQuery().scope).toBe('ACTUAL');
  });

  it('черновик без получателей показывает прочерк, а не «0 / 0» (§4.2)', async () => {
    list.mockResolvedValue(
      page([row({ status: 'DRAFT', dueType: 'NONE', dueAt: null, progress: { submitted: 0, total: 0, pendingReview: 0 } })]),
    );
    renderPage();

    await screen.findByText('Черновик');
    expect(screen.getByText('Без срока')).toBeInTheDocument();
    // Прочерк ищем в колонке прогресса, а не по всей строке: у задания вне урока
    // такой же прочерк стоит в «Привязке», и текстовый поиск нашёл бы оба.
    const cells = within(screen.getByRole('button', { name: /Открыть задание/ })).getAllByRole('cell');
    expect(cells.at(-1)).toHaveTextContent('—');
  });
});
