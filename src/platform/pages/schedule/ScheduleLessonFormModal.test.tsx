import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleLessonFormModal } from './ScheduleLessonFormModal';
import type { ConstructorContextView, LessonPeriodSlot } from '@/platform/services/schedules';

describe('ScheduleLessonFormModal accessibility', () => {
  it('associates required-field errors with the select and focuses the first missing value', async () => {
    const user = userEvent.setup();
    const period = {
      id: 1,
      bellTemplateId: 10,
      lessonNumber: 1,
      startTime: '08:00:00',
      endTime: '08:45:00',
      sortOrder: 1,
    } as LessonPeriodSlot;
    const onSubmit = vi.fn(async () => undefined);

    render(
      <ScheduleLessonFormModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        pending={false}
        mode="create"
        lockedSlot={{ weekday: 'MONDAY', lessonPeriodId: 1 }}
        periods={[period]}
        context={{ subjects: [], teachers: [], groupSets: [] } as unknown as ConstructorContextView}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    const subject = screen.getByLabelText('Предмет');
    expect(subject).toHaveFocus();
    expect(subject).toHaveAttribute('aria-invalid', 'true');
    const errorId = subject.getAttribute('aria-describedby');
    expect(document.getElementById(errorId as string)).toHaveTextContent('Выберите предмет');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
