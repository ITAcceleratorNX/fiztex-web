import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ResultsPage } from './ResultsPage';

const useResultsPage = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useResultsPage: (...args: unknown[]) => useResultsPage(...args),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

describe('ResultsPage', () => {
  it('reads filters from URL and keeps them in detail links', async () => {
    useResultsPage.mockReturnValue({
      data: {
        content: [
          {
            attemptId: 42,
            applicantName: 'Анна Иванова',
            testTitle: 'Math',
            totalScore: 5,
            maxScore: 6,
            minScore: 3,
            status: 'REVIEWED',
            finishedAt: '2026-07-20T10:00:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/results?status=REVIEWED&search=Анна&page=1']}>
        <Routes>
          <Route path="/results" element={<><ResultsPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(useResultsPage).toHaveBeenCalledWith('REVIEWED', 'Анна', 1, 20);

    const detailLink = screen.getByRole('link', { name: /посмотреть/i });
    expect(detailLink).toHaveAttribute('href', '/results/attempts/42?status=REVIEWED&search=%D0%90%D0%BD%D0%BD%D0%B0&page=1');
  });

  it('updates URL when the status filter changes', async () => {
    useResultsPage.mockReturnValue({
      data: { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route path="/results" element={<><ResultsPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Ожидают ревью' }));
    await user.click(screen.getByRole('option', { name: 'Проверенные' }));
    const locations = screen.getAllByTestId('location');
    expect(locations.at(-1)).toHaveTextContent('/results?status=REVIEWED');
  });
});

