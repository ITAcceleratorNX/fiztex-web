import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssessmentBadge } from './AssessmentBadge';

describe('плашка СОР/СОЧ в расписании', () => {
  it('запланированная и проведённая различаются подсказкой', () => {
    const { rerender } = render(<AssessmentBadge title="СОР 1" />);
    expect(screen.getByTitle('СОР 1: запланирована')).toHaveTextContent('СОР 1');
    rerender(<AssessmentBadge title="СОР 1" conducted />);
    expect(screen.getByTitle('СОР 1: проведена')).toBeInTheDocument();
  });

  it('работе без урока говорит, что нужен новый урок', () => {
    render(<AssessmentBadge title="СОЧ" needsReschedule />);
    expect(screen.getByTitle('СОЧ: нужно выбрать новый урок')).toBeInTheDocument();
  });
});
