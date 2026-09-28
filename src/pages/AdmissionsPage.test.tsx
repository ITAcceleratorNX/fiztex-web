import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdmissionsPage } from './AdmissionsPage';

vi.mock('@/hooks/queries', () => ({
  useSubjects: () => ({ data: [] }),
  useTests: () => ({ data: [], isSuccess: true }),
  useApplicants: () => ({ data: [] }),
}));

vi.mock('./tabs/AdmissionTestsTab', () => ({
  AdmissionTestsTab: () => <div>tests-tab</div>,
}));

vi.mock('./tabs/ApplicantsTab', () => ({
  ApplicantsTab: () => <div>applicants-tab</div>,
}));

vi.mock('@/components/admissions/NotificationsBell', () => ({
  NotificationsBell: ({ onOpenAttempt }: { onOpenAttempt: (attemptId: number) => void }) => (
    <button onClick={() => onOpenAttempt(42)}>open notification</button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

describe('AdmissionsPage', () => {
  it('navigates to results deep-link from notifications', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/admissions']}>
        <Routes>
          <Route path="/admissions" element={<><AdmissionsPage /><LocationProbe /></>} />
          <Route path="/results/attempts/:attemptId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open notification' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/results/attempts/42');
  });

  it('сохраняет отдельные фильтры тестов при переходе на другую вкладку и обратно', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admissions?tab=applicants&testQ=механика&testStatus=DRAFT']}>
        <AdmissionsPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Тесты' }));
    expect(screen.getByText('tests-tab')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admissions?testQ=%D0%BC%D0%B5%D1%85%D0%B0%D0%BD%D0%B8%D0%BA%D0%B0&testStatus=DRAFT',
    );
  });
});
