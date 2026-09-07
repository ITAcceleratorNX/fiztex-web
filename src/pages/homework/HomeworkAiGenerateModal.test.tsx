import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkAiGenerateModal } from './HomeworkAiGenerateModal';

const useHomeworkAiQuota = vi.fn();
const useLessonMaterials = vi.fn();
const useHomeworkAiJob = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const idleMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({ id: 1 }),
  isPending: false,
});

vi.mock('@/hooks/queries', () => ({
  useHomeworkAiQuota: (...args: unknown[]) => useHomeworkAiQuota(...args),
  useLessonMaterials: (...args: unknown[]) => useLessonMaterials(...args),
  useHomeworkAiJob: (...args: unknown[]) => useHomeworkAiJob(...args),
  useStartHomeworkAiGeneration: () => idleMutation(),
  useApplyHomeworkAiResult: () => idleMutation(),
}));

function renderModal(props: Partial<Parameters<typeof HomeworkAiGenerateModal>[0]> = {}) {
  render(
    <HomeworkAiGenerateModal
      open
      onClose={vi.fn()}
      homeworkId={5}
      lessonId={1}
      kind="MATERIAL"
      onWriteManually={vi.fn()}
      {...props}
    />,
  );
}

describe('HomeworkAiGenerateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHomeworkAiQuota.mockReturnValue({
      data: { enabled: true, dailyQuota: 50, used: 3, remaining: 47 },
    });
    useLessonMaterials.mockReturnValue({
      data: [{ id: 10, kind: 'FILE', fileName: 'конспект.pdf' }],
      isPending: false,
    });
    useHomeworkAiJob.mockReturnValue({ data: undefined });
  });

  /** Внезапный отказ по лимиту хуже заметного счётчика — остаток виден всегда. */
  it('показывает остаток квоты до запуска', () => {
    renderModal();
    expect(screen.getByText(/Осталось 47 генераций из 50/)).toBeInTheDocument();
  });

  it('исчерпанная квота выключает кнопку и объясняет, что делать', () => {
    useHomeworkAiQuota.mockReturnValue({
      data: { enabled: true, dailyQuota: 50, used: 50, remaining: 0 },
    });
    renderModal();

    expect(screen.getByRole('button', { name: /Сгенерировать/ })).toBeDisabled();
    expect(screen.getByText(/Лимит генераций на сегодня исчерпан/)).toBeInTheDocument();
  });

  /** Материалы предложены все: учитель приложил их к уроку именно ради этого. */
  it('материалы урока отмечены по умолчанию', () => {
    renderModal();
    expect(screen.getByRole('checkbox', { name: /конспект.pdf/ })).toBeChecked();
  });

  it('без материалов объясняет, что генерация всё равно возможна', () => {
    useLessonMaterials.mockReturnValue({ data: [], isPending: false });
    renderModal();
    expect(screen.getByText('У урока нет материалов')).toBeInTheDocument();
  });

  /** Задание вне урока генерировать нечем — и это сказано до нажатия, а не после отказа. */
  it('для задания вне урока предупреждает и выключает кнопку', () => {
    renderModal({ lessonId: null });
    expect(screen.getByText(/генерация работает только для заданий из урока/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сгенерировать/ })).toBeDisabled();
  });

  it('у теста спрашивает число вопросов и долю открытых', () => {
    renderModal({ kind: 'TEST' });
    expect(screen.getByText('Всего вопросов')).toBeInTheDocument();
    expect(screen.getByText('Из них открытых')).toBeInTheDocument();
  });

  /**
   * Главная ветка задачи AIHW-R: работа учителя не заменяется молча, выбор делает он.
   */
  it('когда результат ждёт решения, предлагает заменить или оставить', () => {
    useHomeworkAiJob.mockReturnValue({
      data: {
        id: 7,
        homeworkId: 5,
        kind: 'MATERIAL',
        status: 'DONE',
        applied: false,
        awaitingDecision: true,
      },
    });
    renderModal();

    expect(screen.getByText(/новый вариант не применён автоматически/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Заменить мой текст' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Оставить как есть' })).toBeInTheDocument();
  });
});
