import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestAiJob } from '@/lib/testTemplateApi';
import { ApiError } from '@/lib/api';
import { GenerateWorkspaceTestModal } from './GenerateWorkspaceTestModal';

const state = vi.hoisted(() => ({ overview: vi.fn(), source: vi.fn(), start: vi.fn() }));
vi.mock('@/hooks/queries', () => ({
  useTestAiOverview: () => state.overview(),
  usePreparationAiSource: () => state.source(),
  useStartTestAiGeneration: () => ({ mutateAsync: state.start, isPending: false }),
}));
vi.mock('@/components/workspace/WorkspaceMaterialPickerModal', () => ({
  WorkspaceMaterialPickerModal: ({ onConfirm, onClose }: { onConfirm: (items: unknown[]) => void; onClose: () => void }) =>
    <button onClick={() => { onConfirm([{ id: 12, title: 'Механика', type: 'TEXTBOOK' }]); onClose(); }}>Выбрать учебник</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.overview.mockReturnValue({ data: { aiEnabled: true, remainingCalls: 10 }, refetch: vi.fn() });
  state.source.mockReturnValue({ data: undefined, isPending: false });
  state.start.mockResolvedValue({ id: 5, status: 'PENDING' });
});

function renderModal(initialTopic = 'Механика') {
  const onUse = vi.fn();
  const onClose = vi.fn();
  render(<GenerateWorkspaceTestModal initialTopic={initialTopic} onUse={onUse} onClose={onClose} />);
  return { onUse, onClose };
}

const resultJob: TestAiJob = {
  id: 5, status: 'DONE', request: { topic: 'Механика', questionCount: 1, openQuestionCount: 1 },
  result: { questions: [{ type: 'OPEN_TEXT', text: 'Что такое инерция?', referenceAnswer: 'Сохранение скорости.', maxScore: 1, aiGenerated: true }] },
};

describe('GenerateWorkspaceTestModal', () => {
  it('отправляет тему и параметры без урока и ДЗ, не применяя результат автоматически', async () => {
    const user = userEvent.setup();
    const { onUse } = renderModal();
    await user.type(screen.getByRole('textbox', { name: 'Для кого' }), '7 класс');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    await waitFor(() => expect(state.start).toHaveBeenCalledWith({ body: {
      topic: 'Механика', audience: '7 класс', language: 'ru', teacherPrompt: '', questionCount: 10, openQuestionCount: 2,
    }, key: expect.any(String) }));
    expect(onUse).not.toHaveBeenCalled();
  });

  it('проверяет количество и пустую тему до запроса', async () => {
    const user = userEvent.setup();
    renderModal('');
    expect(screen.getByRole('button', { name: 'Сгенерировать' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Тема теста' }), 'Механика');
    const count = screen.getByRole('spinbutton', { name: 'Всего вопросов' });
    await user.clear(count);
    await user.type(count, '31');
    expect(screen.getByText('Укажите от 1 до 30 вопросов.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сгенерировать' })).toBeDisabled();
    expect(state.start).not.toHaveBeenCalled();
  });

  it('передаёт выбранный источник и диапазон PDF без привязки к уроку', async () => {
    const user = userEvent.setup();
    state.source.mockReturnValue({ data: { pageNavigation: true, pageCount: 100, maxPages: 30 } });
    renderModal();
    await user.click(screen.getByRole('radio', { name: 'По учебнику' }));
    await user.click(screen.getByRole('button', { name: 'Выбрать из рабочего пространства' }));
    await user.click(screen.getByRole('button', { name: 'Выбрать учебник' }));
    expect(screen.getByRole('button', { name: 'Сгенерировать' })).toBeDisabled();
    await user.type(screen.getByRole('spinbutton', { name: 'Со страницы' }), '5');
    await user.type(screen.getByRole('spinbutton', { name: 'По страницу' }), '10');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    await waitFor(() => expect(state.start).toHaveBeenCalledWith({ body: expect.objectContaining({
      sourceType: 'TEXTBOOK', workspaceItemId: 12, pageFrom: 5, pageTo: 10,
    }), key: expect.any(String) }));
  });

  it('восстанавливает готовый результат и переносит его только по кнопке', async () => {
    state.overview.mockReturnValue({ data: { aiEnabled: true, remainingCalls: 9, latestJob: resultJob } });
    const user = userEvent.setup();
    const { onUse, onClose } = renderModal();
    expect(screen.getByText('Что такое инерция?')).toBeInTheDocument();
    expect(onUse).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Использовать вопросы' }));
    expect(onUse).toHaveBeenCalledWith(resultJob);
    expect(onClose).toHaveBeenCalled();
  });

  it('разрешает закрыть окно работающей генерации и блокирует повторный запуск', async () => {
    state.overview.mockReturnValue({ data: { aiEnabled: true, remainingCalls: 9, latestJob: { status: 'RUNNING', phase: 'CALLING_MODEL' } } });
    const user = userEvent.setup();
    const { onClose } = renderModal();
    expect(screen.getByText('Окно можно закрыть — результат сохранится и дождётся вас.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сгенерировать' })).toBeDisabled();
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Закрыть' }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });

  it('повторяет неясный сетевой ответ с тем же ключом и не теряет введённую тему', async () => {
    state.start.mockRejectedValue(new ApiError(503, 'Сервис недоступен'));
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Сервис недоступен');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    await waitFor(() => expect(state.start).toHaveBeenCalledTimes(2));
    expect(state.start.mock.calls[0][0].key).toBe(state.start.mock.calls[1][0].key);
    expect(screen.getByRole('textbox', { name: 'Тема теста' })).toHaveValue('Механика');
  });

  it('при исчерпанном лимите позволяет взять уже готовые вопросы', () => {
    state.overview.mockReturnValue({ data: { aiEnabled: true, remainingCalls: 0, latestJob: resultJob } });
    renderModal();
    expect(screen.getByRole('button', { name: 'Сгенерировать заново' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Использовать вопросы' })).toBeEnabled();
  });
});
