import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyDetailPage } from './SurveyDetailPage';
import {
  useEndSurvey,
  usePublishSurvey,
  useSetSurveyAudience,
  useSurvey,
  useSurveyAudienceClasses,
} from '@/hooks/surveyQueries';

vi.mock('@/hooks/surveyQueries', () => ({
  useSurvey: vi.fn(),
  usePublishSurvey: vi.fn(),
  useEndSurvey: vi.fn(),
  useSurveyAudienceClasses: vi.fn(),
  useSetSurveyAudience: vi.fn(),
}));

// Вкладки проверяются своими тестами; здесь — только оболочка карточки и её варианты.
vi.mock('@/components/survey/SurveyQuestionEditor', () => ({ SurveyQuestionEditor: () => <div>Вопросы опроса</div> }));
vi.mock('@/components/survey/SurveyResultsTab', () => ({ SurveyResultsTab: () => <div>Результаты опроса</div> }));
vi.mock('@/components/survey/SurveyAiAnalysisTab', () => ({ SurveyAiAnalysisTab: () => <div>AI-анализ опроса</div> }));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function renderAt(path: string, variant: 'school' | 'psychology') {
  const pattern = variant === 'psychology' ? '/psychologist/tests/:surveyId' : '/surveys/:surveyId';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<SurveyDetailPage variant={variant} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SurveyDetailPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSurvey).mockReturnValue({
      data: { id: 9, title: 'Тревожность', status: 'DRAFT', canEdit: true, targetsStudents: true, audienceClassIds: [] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useSurvey>);
    const idle = { isPending: false, mutateAsync: vi.fn() };
    vi.mocked(usePublishSurvey).mockReturnValue(idle as unknown as ReturnType<typeof usePublishSurvey>);
    vi.mocked(useEndSurvey).mockReturnValue(idle as unknown as ReturnType<typeof useEndSurvey>);
    vi.mocked(useSetSurveyAudience).mockReturnValue(idle as unknown as ReturnType<typeof useSetSurveyAudience>);
    vi.mocked(useSurveyAudienceClasses).mockReturnValue({
      data: [{ id: 1, name: '7А', grade: '7', letter: 'А', studentsCount: 25 }],
    } as unknown as ReturnType<typeof useSurveyAudienceClasses>);
  });

  it('психологический тест: без вкладки AI-анализа и с возвратом в кабинет психолога', () => {
    // Даже прямой адрес ?tab=ai не открывает анализ — вкладки у теста нет.
    renderAt('/psychologist/tests/9?tab=ai', 'psychology');

    expect(screen.queryByRole('tab', { name: 'AI-анализ' })).not.toBeInTheDocument();
    expect(screen.queryByText('AI-анализ опроса')).not.toBeInTheDocument();
    expect(screen.getByText('Вопросы опроса')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /К психологическим тестам/ })).toHaveAttribute('href', '/psychologist/tests');
  });

  it('школьный опрос сохраняет вкладку AI-анализа', () => {
    renderAt('/surveys/9', 'school');
    expect(screen.getByRole('tab', { name: 'AI-анализ' })).toBeInTheDocument();
  });
});
