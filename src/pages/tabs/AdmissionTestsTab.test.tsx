import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Test } from '@/lib/types';
import { AdmissionTestsTab } from './AdmissionTestsTab';

vi.mock('@/hooks/queries', () => ({
  useTests: () => ({
    data: [
      {
        id: 4,
        title: 'Тест по механике',
        subjectId: 2,
        subjectName: 'Физика',
        grade: '7 класс',
        status: 'DRAFT',
        assignmentCount: 0,
        currentVersionNumber: 1,
        currentVersionCreatedAt: '2026-01-01T00:00:00Z',
      } as Test,
    ],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/pages/modals/TestFormModal', () => ({
  TestFormModal: ({ open, test }: { open: boolean; test: Test | null }) =>
    open ? <div role="dialog" aria-label={`Редактировать ${test?.title}`} /> : null,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

describe('AdmissionTestsTab actions', () => {
  it('uses a real card link and keeps editing as a separate action', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/admissions']}>
        <Routes>
          <Route path="/admissions" element={<><AdmissionTestsTab /><LocationProbe /></>} />
          <Route path="/admissions/tests/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const testLink = screen.getByRole('link', { name: 'Тест по механике' });
    expect(testLink).toHaveAttribute('href', '/admissions/tests/4');

    await user.click(screen.getByRole('button', { name: 'Редактировать тест «Тест по механике»' }));
    expect(screen.getByRole('dialog', { name: 'Редактировать Тест по механике' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admissions');
  });
});
