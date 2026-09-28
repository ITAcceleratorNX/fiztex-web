import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { homeworkListReturnTo } from '@/lib/homeworkListNavigation';
import { HomeworkListPage } from './HomeworkListPage';

const list = vi.fn();
const options = vi.fn();
vi.mock('@/lib/textbooksApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/textbooksApi')>();
  return { ...actual, textbookBindingsApi: { ...actual.textbookBindingsApi, options: (...args: unknown[]) => options(...args) } };
});

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

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="url">{location.pathname + location.search}</output>
    <button onClick={() => navigate(-1)}>Browser Back</button>
    <button onClick={() => navigate(1)}>Browser Forward</button></>;
}
function Card() {
  const { search } = useLocation();
  return <Link to={homeworkListReturnTo(search)}>К списку заданий</Link>;
}
function renderPage(url = '/homework') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Navigation />
        <main><Routes>
          <Route path="/homework" element={<HomeworkListPage />} />
          <Route path="/homework/:homeworkId" element={<Card />} />
        </Routes></main>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Аргументы последнего запроса списка — то, что экран реально попросил у сервера. */
function lastQuery() {
  return [...list.mock.calls].reverse().find(([params]) => 'pendingReviewOnly' in params)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  list.mockReset();
  options.mockReset().mockResolvedValue({ years: [{ assignments: [
    { classId: 7, className: '7А', subjectId: 3, subjectName: 'Математика' },
    { classId: 9, className: '9Б', subjectId: 4, subjectName: 'Физика' },
  ] }] });
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

    await userEvent.click(screen.getByRole('radio', { name: 'История' }));

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

    await userEvent.click(screen.getByRole('radio', { name: 'История' }));

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

    await userEvent.click(screen.getByRole('radio', { name: 'История' }));

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


describe('пагинация домашних заданий (UX-04)', () => {
  for (const scope of ['ACTUAL', 'HISTORY']) {
    it.each([0, 1, 50, 51, 101])(`${scope}: все %i заданий достижимы без дублей и пропусков`, async (total) => {
      list.mockImplementation(({ page: index, size }: { page: number; size: number }) => Promise.resolve({
        content: Array.from({ length: Math.max(0, Math.min(size, total - index * size)) }, (_, i) => row({
          id: index * size + i + 1, title: `Задание ${index * size + i + 1}`,
          status: scope === 'HISTORY' ? 'COMPLETED' : 'PUBLISHED',
        })),
        number: index, totalElements: total, totalPages: Math.ceil(total / size), last: (index + 1) * size >= total,
      }));
      renderPage(`/homework?scope=${scope}`);
      const ids: string[] = [];
      for (let index = 0; index < Math.max(1, Math.ceil(total / 50)); index++) {
        if (!total) {
          await screen.findByText(scope === 'HISTORY' ? 'В истории пока ничего нет' : 'Нет актуальных заданий');
          break;
        }
        await screen.findByText(`Задание ${index * 50 + 1}`);
        ids.push(...screen.getAllByRole('button', { name: /Открыть задание/ }).map((el) => el.getAttribute('aria-label')!));
        if ((index + 1) * 50 < total) await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
      }
      expect(ids).toHaveLength(total);
      expect(new Set(ids).size).toBe(total);
      expect(list.mock.calls.every(([params]) => params.size === 50 && params.scope === scope)).toBe(true);
      if (total > 50) expect(screen.getByRole('button', { name: 'Следующая страница' })).toBeDisabled();
      else expect(screen.queryByRole('navigation', { name: 'Страницы домашних заданий' })).not.toBeInTheDocument();
    });
  }

  it('класс и предмет вне первой страницы доступны из контекста учителя', async () => {
    list.mockResolvedValue(page([row()]));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');
    await waitFor(() => expect(options).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Класс' }));
    await userEvent.click(await screen.findByRole('option', { name: '9Б' }));
    expect(lastQuery()).toMatchObject({ classId: 9, page: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Предмет' }));
    await userEvent.click(screen.getByRole('option', { name: 'Физика' }));
    expect(lastQuery()).toMatchObject({ classId: 9, subjectId: 4 });
  });

  it('сбой следующей страницы сохраняет строки и повторяет именно нужную страницу', async () => {
    list.mockResolvedValueOnce({ ...page([row()]), totalElements: 51, totalPages: 2 })
      .mockRejectedValueOnce(new ApiError(500, 'boom'));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');
    await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await screen.findByText('Не удалось загрузить страницу 2. Показана страница 1');
    expect(screen.getByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('page=2');
    list.mockResolvedValue({ ...page([row({ id: 51, title: 'Последнее задание' })]), number: 1, totalElements: 51, totalPages: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('Последнее задание');
    expect(lastQuery()).toMatchObject({ page: 1, size: 50 });
    expect(screen.queryByText('Параграф 12, упражнения 1–5')).not.toBeInTheDocument();
  });

  it.each(['Browser Back', 'К списку заданий'])('возвращает страницу, фильтры и прокрутку: %s', async (back) => {
    list.mockResolvedValue({ ...page([row({ id: 51 })]), number: 1, totalElements: 101, totalPages: 3 });
    renderPage('/homework?scope=HISTORY&page=2&classId=7&subjectId=3&status=COMPLETED');
    await screen.findByText('Параграф 12, упражнения 1–5');
    const main = screen.getByRole('main');
    main.scrollTop = 480;
    fireEvent.scroll(main);
    await userEvent.click(screen.getByRole('button', { name: /Открыть задание/ }));
    expect(screen.getByTestId('url')).toHaveTextContent('/homework/51?returnTo=');
    main.scrollTop = 0;
    await userEvent.click(screen.getByRole(back === 'Browser Back' ? 'button' : 'link', { name: back }));
    await screen.findByText('Параграф 12, упражнения 1–5');
    expect(lastQuery()).toMatchObject({ page: 1, scope: 'HISTORY', classId: 7, subjectId: 3, statuses: ['COMPLETED'] });
    expect(main.scrollTop).toBe(480);
  });

  it('смена фильтра или вкладки сбрасывает страницу, Browser Back и Forward восстанавливают её', async () => {
    list.mockImplementation(({ page: index }: { page: number }) => Promise.resolve({ ...page([row()]), number: index, totalPages: 3, totalElements: 101 }));
    renderPage('/homework?page=3');
    await screen.findByText('Параграф 12, упражнения 1–5');
    await userEvent.click(screen.getByRole('button', { name: 'Статус' }));
    await userEvent.click(screen.getByRole('option', { name: 'Черновик' }));
    expect(lastQuery()).toMatchObject({ page: 0, statuses: ['DRAFT'] });
    await userEvent.click(screen.getByRole('button', { name: 'Browser Back' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));
    await userEvent.click(screen.getByRole('button', { name: 'Browser Forward' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 0, statuses: ['DRAFT'] }));
    await userEvent.click(screen.getByRole('radio', { name: 'История' }));
    expect(lastQuery()).toMatchObject({ page: 0, scope: 'HISTORY', statuses: undefined });
  });

  it('устаревшая ссылка за концом списка переводит на последнюю существующую страницу', async () => {
    list.mockImplementation(({ page: index }: { page: number }) => Promise.resolve({
      ...page(index > 1 ? [] : [row()]), number: index, totalPages: 2, totalElements: 51,
    }));
    renderPage('/homework?page=99');
    await screen.findByText('Параграф 12, упражнения 1–5');
    expect(lastQuery().page).toBe(1);
    expect(screen.getByTestId('url')).toHaveTextContent('/homework?page=2');
  });

  it('ошибка контекста не скрывает задания, повтор восстанавливает полный фильтр', async () => {
    options.mockRejectedValueOnce(new ApiError(500, 'boom'));
    list.mockResolvedValue(page([row()]));
    renderPage();
    await screen.findByText('Не удалось загрузить полный список классов и предметов');
    expect(screen.getByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(screen.queryByText('Не удалось загрузить полный список классов и предметов')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Класс' }));
    expect(await screen.findByRole('option', { name: '9Б' })).toBeInTheDocument();
  });
});


describe('исторические варианты фильтров (UX-04)', () => {
  it('находит архивный класс и предмет после 50-й записи без действующего назначения', async () => {
    list.mockImplementation((params: { scope: string; page: number; pendingReviewOnly?: boolean }) => Promise.resolve({
      ...page([row(params.scope === 'HISTORY' && params.page === 1
        ? { id: 102, classId: 42, className: 'Архивный 11А', subjectId: 20, subjectName: 'Астрономия' } : {})]),
      number: params.page, totalPages: 2, totalElements: 51, last: params.page === 1,
    }));
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');
    expect(list.mock.calls).toHaveLength(1); // Полный справочник загружается по потребности.
    await userEvent.click(screen.getByRole('button', { name: 'Класс' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Архивный 11А' }));
    expect(lastQuery()).toMatchObject({ classId: 42, page: 0, size: 50 });
    const scan = list.mock.calls.filter(([params]) => !('pendingReviewOnly' in params));
    expect(scan.map(([params]) => [params.scope, params.page, params.size])).toEqual([
      ['ACTUAL', 0, 50], ['ACTUAL', 1, 50], ['HISTORY', 0, 50], ['HISTORY', 1, 50],
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Предмет' }));
    expect(screen.getByRole('option', { name: 'Астрономия' })).toBeInTheDocument();
  });

  it('при сбое исторического справочника сохраняет задания и доступные варианты, позволяет повторить', async () => {
    let fail = true;
    list.mockImplementation((params: Record<string, unknown>) => {
      if (!('pendingReviewOnly' in params) && fail) return Promise.reject(new ApiError(500, 'boom'));
      return Promise.resolve(page([row()]));
    });
    renderPage();
    await screen.findByText('Параграф 12, упражнения 1–5');
    await userEvent.click(screen.getByRole('button', { name: 'Класс' }));
    await screen.findByText('Не удалось загрузить варианты из истории заданий. Доступные варианты сохранены');
    expect(screen.getByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '9Б' })).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(screen.queryByText('Не удалось загрузить варианты из истории заданий. Доступные варианты сохранены')).not.toBeInTheDocument());
  });
});
