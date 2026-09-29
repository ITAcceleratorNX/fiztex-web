import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { surveyApi, type SurveyPage, type SurveyStatus } from '@/lib/surveyApi';
import { SurveysPage } from './SurveysPage';

const list = vi.spyOn(surveyApi, 'list');
afterEach(() => list.mockReset());

function entry(id: number, status: SurveyStatus) {
  return { id, title: `Опрос ${id}`, status, mode: 'NAMED', respondedCount: 2, recipientsTotal: 5 };
}
function page(content: ReturnType<typeof entry>[], totalElements: number, number = 0): SurveyPage {
  return { content, totalElements, totalPages: Math.ceil(totalElements / 20), number, size: 20, last: (number + 1) * 20 >= totalElements };
}
function CurrentUrl() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname + location.search}</output>;
}
function renderPage(url = '/surveys', variant: 'school' | 'psychology' = 'school') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const path = variant === 'psychology' ? '/psychologist/tests' : '/surveys';
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>
    <CurrentUrl /><Routes>
      <Route path={path} element={<SurveysPage variant={variant} />} />
      <Route path={variant === 'psychology' ? '/psychologist/tests/:id' : '/surveys/:id'} element={<p>Карточка</p>} />
    </Routes>
  </MemoryRouter></QueryClientProvider>);
}

describe('SurveysPage pagination and server filters (UX-05)', () => {
  it('requests the URL page and displays its trustworthy total', async () => {
    list.mockImplementation(async (status, pageable = {}) => status === 'ACTIVE'
      ? page([entry(21 + (pageable.page ?? 0), 'ACTIVE')], 41, pageable.page ?? 0)
      : page(status ? [entry(1, status)] : [entry(1, 'DRAFT')], status === 'DRAFT' ? 2 : status === 'COMPLETED' ? 3 : 41));
    renderPage('/surveys?status=ACTIVE&page=2');

    expect(await screen.findByText('Опрос 22')).toBeInTheDocument();
    expect(screen.getByText('Страница 2 из 3 · Всего по фильтру: 41')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('ACTIVE', { page: 1, size: 20 }, expect.anything());
    expect(screen.getByTestId('url')).toHaveTextContent('/surveys?status=ACTIVE&page=2');
    expect(screen.getByText('Всего').parentElement).toHaveTextContent('46');
    expect(screen.getByText('Активных').parentElement).toHaveTextContent('41');
    expect(screen.getByText('Черновиков').parentElement).toHaveTextContent('2');
  });

  it('shows the filtered total when the result fits on one page', async () => {
    list.mockImplementation(async (status, pageable = {}) => status === 'ACTIVE'
      ? page([entry(1, 'ACTIVE')], 1, pageable.page ?? 0)
      : page([entry(2, status ?? 'DRAFT')], 1));
    renderPage('/surveys?status=ACTIVE');

    expect(await screen.findByText('Опрос 1')).toBeInTheDocument();
    expect(screen.getByText('Страница 1 из 1 · Всего по фильтру: 1')).toBeInTheDocument();
  });

  it('moves across the full server-filtered survey result with the page URL', async () => {
    list.mockImplementation(async (status, pageable = {}) => {
      if (status === 'ACTIVE' && pageable.size === 20) {
        const pageNumber = pageable.page ?? 0;
        const start = pageNumber * 20;
        return page(Array.from({ length: Math.min(20, 21 - start) }, (_, index) => entry(start + index + 1, 'ACTIVE')), 21, pageNumber);
      }
      return page([entry(1, status ?? 'DRAFT')], status === 'ACTIVE' ? 41 : status === 'DRAFT' ? 2 : 3);
    });
    renderPage('/surveys?status=ACTIVE');
    expect(await screen.findByText('Опрос 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(await screen.findByText('Опрос 21')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('/surveys?status=ACTIVE&page=2');
    expect(screen.getByText('Страница 2 из 2 · Всего по фильтру: 21')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Следующая страница' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущая страница' }));
    expect(await screen.findByText('Опрос 1')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('/surveys?status=ACTIVE');
  });

  it('sends status changes to the server, resets page and changes the URL', async () => {
    list.mockImplementation(async (status, pageable = {}) => {
      if (status === 'COMPLETED') return page([entry(77 + (pageable.page ?? 0), 'COMPLETED')], 21, pageable.page ?? 0);
      return page([entry(1, status ?? 'DRAFT')], 1);
    });
    renderPage('/surveys?status=ACTIVE&page=2');
    await screen.findByText('Опрос 1');
    await userEvent.click(screen.getByRole('button', { name: 'Активен', exact: true }));
    await userEvent.click(screen.getByRole('option', { name: 'Завершён', exact: true }));
    expect(await screen.findByText('Опрос 77')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('COMPLETED', { page: 0, size: 20 }, expect.anything());
    expect(screen.getByTestId('url')).toHaveTextContent('/surveys?status=COMPLETED');
  });

  it.each([
    ['school', '/surveys', '/surveys/22?returnTo='],
    ['psychology', '/psychologist/tests', '/psychologist/tests/22?returnTo='],
  ] as const)('%s list returns to its filtered page from a card', async (variant, route, expected) => {
    list.mockImplementation(async (status, pageable = {}) => status === 'ACTIVE'
      ? page([entry(22, 'ACTIVE')], 41, pageable.page ?? 0)
      : page([entry(1, status ?? 'DRAFT')], 1));
    renderPage(`${route}?status=ACTIVE&page=2`, variant);
    await screen.findByText('Опрос 22');
    await userEvent.click(screen.getByText('Опрос 22'));
    expect(screen.getByText('Карточка')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent(expected);
    expect(screen.getByTestId('url')).toHaveTextContent(encodeURIComponent(`${route}?status=ACTIVE&page=2`));
  });
});
