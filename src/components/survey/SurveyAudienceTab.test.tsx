import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyAudienceTab } from './SurveyAudienceTab';
import { useSetSurveyAudience } from '@/hooks/surveyQueries';
import { groupAudienceClasses, type AudienceClass } from '@/lib/surveyModel';
import type { Survey } from '@/lib/surveyApi';

const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('@/hooks/surveyQueries', () => ({
  useSetSurveyAudience: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
}));

const CLASSES: AudienceClass[] = [
  { id: 1, name: '7А', grade: '7', letter: 'А', studentsCount: 25 },
  { id: 2, name: '7Б', grade: '7', letter: 'Б', studentsCount: 0 },
];

const DRAFT: Survey = { id: 9, status: 'DRAFT', targetsStudents: true, targetsParents: false, audienceClassIds: [] };

describe('SurveyAudienceTab', () => {
  const mutateAsync = vi.fn();

  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
    vi.mocked(useSetSurveyAudience).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as unknown as ReturnType<typeof useSetSurveyAudience>);
  });

  it('психологический тест: без переключателя родителей и всегда только ученикам', async () => {
    const user = userEvent.setup();
    render(
      <SurveyAudienceTab
        survey={DRAFT}
        classes={CLASSES}
        gradeGroups={groupAudienceClasses(CLASSES)}
        canEdit
        studentsOnly
      />,
    );

    expect(screen.queryByText('Родители')).not.toBeInTheDocument();
    expect(screen.getByText('Тест проходят ученики выбранных классов.')).toBeInTheDocument();
    // Пустой класс виден до публикации.
    expect(screen.getByText('нет учеников')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /7А/ }));
    await user.click(screen.getByRole('button', { name: 'Сохранить аудиторию' }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ targetsStudents: true, targetsParents: false, classIds: [1] }),
    );
  });

  it('школьный опрос по-прежнему спрашивает, кого опрашивать', () => {
    render(
      <SurveyAudienceTab survey={DRAFT} classes={CLASSES} gradeGroups={groupAudienceClasses(CLASSES)} canEdit />,
    );
    expect(screen.getByText('Родители')).toBeInTheDocument();
    expect(screen.getByText('Ученики')).toBeInTheDocument();
  });
});
