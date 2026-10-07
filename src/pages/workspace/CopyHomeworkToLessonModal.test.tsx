import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyHomeworkToLessonModal } from './CopyHomeworkToLessonModal';

const copy = vi.fn();
const source = vi.fn();
const lessons = vi.fn();
const refetch = vi.fn();
const next = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useHomeworkCard: () => source(),
  useWorkspaceLessonTargets: (...args: unknown[]) => lessons(...args),
  useNextTaughtLesson: (id: number | null) => next(id),
  useCopyHomeworkToLesson: (id: number) => ({ mutateAsync: (args: unknown) => copy(id, args), isPending: false }),
}));

const lesson = { id: 8, subjectId: 3, subjectName: 'Физика', className: '7Б', date: '2026-10-08',
  academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] };

beforeEach(() => {
  vi.clearAllMocks();
  source.mockReturnValue({ data: { id: 42, title: 'Законы Ньютона', subjectId: 3, lessonId: 5 }, isPending: false, isError: false, refetch });
  lessons.mockReturnValue({ data: { content: [lesson], totalPages: 1 }, isPending: false, isError: false, refetch });
  copy.mockResolvedValue({ id: 99 });
  next.mockReturnValue({ data: { lesson: null }, isPending: false, isError: false, refetch });
});

async function chooseDue(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Срок сдачи копии' }));
  await userEvent.click(screen.getByRole('option', { name }));
}

async function chooseTargetAndDue(due = 'Без срока') {
  await userEvent.click(screen.getByRole('button', { name: /Физика · 7Б/ }));
  await chooseDue(due);
  await userEvent.click(screen.getByRole('checkbox'));
}

describe('Копирование ДЗ в выбранный урок', () => {
  it('предлагает следующий урок этого класса и показывает, куда уйдёт копия', async () => {
    next.mockReturnValue({ data: { lesson: { id: 6, subjectId: 3, subjectName: 'Физика', className: '7А',
      date: '2026-10-12', lessonNumber: 2, startTime: '09:00:00', endTime: '09:45:00',
      academicPeriodStatus: 'ACTIVE', capabilities: ['EDIT_TEACHING_PART'] } }, isPending: false, isError: false, refetch });
    source.mockReturnValue({ data: { id: 42, title: 'Тест по механике', subjectId: 3, lessonId: 5, answerFormat: 'TEST' },
      isPending: false, isError: false, refetch });
    const onCopied = vi.fn();
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={onCopied} />);
    expect(screen.getByRole('heading', { name: 'Скопировать тест в другой урок' })).toBeInTheDocument();
    expect(next).toHaveBeenCalledWith(5);
    await userEvent.click(screen.getByRole('button', { name: /Физика · 7А.*2-й урок/ }));
    // В варианте выбора и в блоке «Куда».
    expect(screen.getAllByText('Понедельник, 12 октября · 2-й урок · 09:00–09:45')).toHaveLength(2);
    expect(screen.getByText('Куда')).toBeInTheDocument();
    await chooseDue('До следующего урока');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(42, expect.objectContaining({
      body: { lessonId: 6, dueType: 'NEXT_LESSON', confirmRecipients: true } })));
    expect(onCopied).toHaveBeenCalledWith(99);
  });

  it('без урока у задания не ищет следующий урок', () => {
    source.mockReturnValue({ data: { id: 42, title: 'Вне урока', subjectId: 3 }, isPending: false, isError: false, refetch });
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={vi.fn()} />);
    expect(next).toHaveBeenCalledWith(null);
    expect(screen.queryByText('Следующий урок этого класса')).not.toBeInTheDocument();
  });

  it('требует выбрать срок и подтвердить новых получателей, затем открывает копию', async () => {
    const onCopied = vi.fn();
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={onCopied} />);
    const submit = screen.getByRole('button', { name: 'Создать черновик' });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 7Б/ }));
    expect(screen.getByText('Получатели нового ДЗ: 7Б, весь класс.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeDisabled();
    await chooseDue('Без срока');
    await userEvent.click(submit);
    await waitFor(() => expect(copy).toHaveBeenCalledWith(42, { body: { lessonId: 8, dueType: 'NONE', confirmRecipients: true }, key: expect.any(String) }));
    expect(onCopied).toHaveBeenCalledWith(99);
  });

  it('сохраняет точный срок и показывает школьную подгруппу вместо прежних учеников', async () => {
    lessons.mockReturnValue({ data: { content: [{ ...lesson, subgroupName: 'Группа 2' }], totalPages: 1 }, isPending: false, isError: false });
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={vi.fn()} />);
    await chooseTargetAndDue('Дата и время');
    const submit = screen.getByRole('button', { name: 'Создать черновик' });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Получатели нового ДЗ: 7Б, подгруппа «Группа 2».')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Дата и время сдачи'), { target: { value: '2026-10-09T18:30' } });
    await userEvent.click(submit);
    expect(copy).toHaveBeenCalledWith(42, { body: { lessonId: 8, dueType: 'EXACT', dueAt: new Date('2026-10-09T18:30').toISOString(), confirmRecipients: true }, key: expect.any(String) });
  });

  it('не позволяет выбрать исходный, чужой предмет или недоступный урок', () => {
    lessons.mockReturnValue({ data: { content: [
      { ...lesson, id: 5, className: '7А' },
      { ...lesson, id: 9, subjectId: 4, subjectName: 'Химия' },
      { ...lesson, id: 10, capabilities: [], className: '8А' },
      { ...lesson, id: 11, academicPeriodStatus: 'ARCHIVED', className: '8Б' },
    ], totalPages: 1 }, isPending: false, isError: false });
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={vi.fn()} />);
    for (const name of [/Урок исходного ДЗ/, /Другой предмет/, /8А.*Недоступен/, /8Б.*Недоступен/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('при смене недели сбрасывает выбор урока и подтверждение получателей', async () => {
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={vi.fn()} />);
    await chooseTargetAndDue('До следующего урока');
    await userEvent.click(screen.getByRole('button', { name: 'Позже' }));
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Физика · 7Б/ }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    expect(copy).toHaveBeenCalledWith(42, { body: { lessonId: 8, dueType: 'NEXT_LESSON', confirmRecipients: true }, key: expect.any(String) });
  });

  it('после сетевой ошибки повторяет тот же запрос с прежним ключом без потери заполненных полей', async () => {
    copy.mockRejectedValueOnce(new Error('Connection lost'));
    const onCopied = vi.fn();
    render(<CopyHomeworkToLessonModal sourceId={42} onClose={vi.fn()} onCopied={onCopied} />);
    await chooseTargetAndDue();
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось скопировать ДЗ');
    expect(onCopied).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));
    expect(copy.mock.calls[1]).toEqual(copy.mock.calls[0]);
    expect(onCopied).toHaveBeenCalledWith(99);
  });

  it('показывает ошибку загрузки источника с повтором, затем пустое расписание', async () => {
    source.mockReturnValueOnce({ isPending: false, isError: true, refetch });
    const props = { sourceId: 42, onClose: vi.fn(), onCopied: vi.fn() };
    const { rerender } = render(<CopyHomeworkToLessonModal {...props} />);
    expect(screen.getByText('Не удалось загрузить данные')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalled();
    lessons.mockReturnValue({ data: { content: [], totalPages: 0 }, isPending: false, isError: false });
    rerender(<CopyHomeworkToLessonModal {...props} />);
    expect(screen.getByText('Нет доступного урока')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать черновик' })).toBeDisabled();
  });
});
