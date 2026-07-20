import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdmissionsPage } from './AdmissionsPage';

vi.mock('@/hooks/queries', () => ({
  useTests: () => ({ data: [], isSuccess: true }),
  useApplicants: () => ({ data: [] }),
}));

vi.mock('./tabs/AdmissionTestsTab', () => ({
  AdmissionTestsTab: () => <div>tests-tab</div>,
}));

vi.mock('./tabs/ApplicantsTab', () => ({
  ApplicantsTab: () => <div>applicants-tab</div>,
}));

vi.mock('./tabs/AttemptsTab', () => ({
  AttemptsTab: () => <div>attempts-tab</div>,
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
});

