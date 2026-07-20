import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ResultReviewPage } from './ResultReviewPage';

vi.mock('@/pages/modals/ReviewModal', () => ({
  ReviewModal: ({
    attemptId,
    variant,
  }: {
    attemptId: number;
    variant: string;
  }) => <div>{`attempt:${attemptId};variant:${variant}`}</div>,
}));

describe('ResultReviewPage', () => {
  it('renders review route by attemptId in page mode', () => {
    render(
      <MemoryRouter initialEntries={['/results/attempts/55?status=REVIEWED&page=1']}>
        <Routes>
          <Route path="/results/attempts/:attemptId" element={<ResultReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('attempt:55;variant:page')).toBeInTheDocument();
  });
});

