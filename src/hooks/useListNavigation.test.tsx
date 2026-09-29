import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { listNavigationStorageKey, listScrollStorageKey, mergeSearchParams } from '@/lib/listNavigation';
import { useListScrollRestoration, useListSearchParams } from './useListNavigation';

function ProbeList() {
  const [params, setParams] = useListSearchParams('demo', ['q', 'status']);
  const location = useLocation();
  return (
    <div>
      <label>
        Search
        <input
          value={params.get('q') ?? ''}
          onChange={(event) => setParams(mergeSearchParams(params, { q: event.target.value || null }))}
        />
      </label>
      <output data-testid="url">{location.pathname + location.search}</output>
      <button onClick={() => setParams(new URLSearchParams())}>Reset filters</button>
      <Link to="/away">Away</Link>
    </div>
  );
}

function ProbeAway() {
  return <Link to="/list">Return to list</Link>;
}

function ScrollProbe() {
  useListScrollRestoration('demo', true);
  return <div />;
}

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/list" element={<ProbeList />} />
        <Route path="/away" element={<ProbeAway />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useListSearchParams', () => {
  it('restores the last list state when the menu returns with an empty URL', async () => {
    sessionStorage.setItem(listNavigationStorageKey('demo'), 'q=restored&status=BLOCKED');
    const user = userEvent.setup();
    renderRoutes('/list');

    await screen.findByDisplayValue('restored');
    expect(screen.getByTestId('url')).toHaveTextContent('/list?q=restored&status=BLOCKED');

    await user.click(screen.getByRole('link', { name: 'Away' }));
    await user.click(screen.getByRole('link', { name: 'Return to list' }));
    await screen.findByDisplayValue('restored');
    expect(screen.getByTestId('url')).toHaveTextContent('/list?q=restored&status=BLOCKED');
  });

  it('prefers URL state and removes the saved state after an explicit reset', async () => {
    sessionStorage.setItem(listNavigationStorageKey('demo'), 'q=old&status=ARCHIVED');
    const user = userEvent.setup();
    renderRoutes('/list?q=current&status=BLOCKED');

    expect(screen.getByDisplayValue('current')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => expect(sessionStorage.getItem(listNavigationStorageKey('demo'))).toBeNull());

    await user.click(screen.getByRole('link', { name: 'Away' }));
    await user.click(screen.getByRole('link', { name: 'Return to list' }));
    await waitFor(() => expect(screen.getByDisplayValue('')).toBeInTheDocument());
    expect(screen.getByTestId('url')).toHaveTextContent('/list');
  });

  it('restores scroll only after the list reports ready', async () => {
    sessionStorage.setItem(listScrollStorageKey('demo'), '280');
    const scroll = vi.spyOn(window, 'scrollTo');
    render(<ScrollProbe />);

    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 280, behavior: 'auto' }));
    scroll.mockRestore();
  });
});
