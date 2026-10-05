import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateLessonPreparationModal } from './GenerateLessonPreparationModal';

const overview = vi.fn();
const source = vi.fn();
const start = vi.fn();
const upload = vi.fn();

vi.mock('@/hooks/queries', () => ({
  usePreparationAiOverview: () => overview(),
  usePreparationAiSource: (...args: unknown[]) => source(...args),
  useStartPreparationAiGeneration: () => ({ mutateAsync: start, isPending: false }),
  useUploadWorkspaceFile: () => ({ mutateAsync: upload, isPending: false, isError: false }),
}));
vi.mock('@/components/workspace/WorkspaceMaterialPickerModal', () => ({
  WorkspaceMaterialPickerModal: ({ type, onConfirm, onClose }: {
    type: string; onConfirm: (items: object[]) => void; onClose: () => void;
  }) => <button onClick={() => {
    onConfirm([{ id: type === 'TEXTBOOK' ? 37 : 42, title: type === 'TEXTBOOK' ? 'Физика 8' : 'Механика.pdf', type }]);
    onClose();
  }}>Подтвердить источник</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  overview.mockReturnValue({ data: { aiEnabled: true, remainingCalls: 10, latestJob: null } });
  source.mockImplementation((_type, id) => ({ data: id ? { pageNavigation: true, pageCount: 80, maxPages: 30 } : undefined }));
  start.mockResolvedValue({ id: 1, status: 'PENDING' });
});

describe('ИИ для независимой заготовки', () => {
  it('передаёт только источник из рабочего пространства, страницы и ключ повтора', async () => {
    start.mockRejectedValueOnce(new Error('network'));
    render(<GenerateLessonPreparationModal onClose={vi.fn()} onUse={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать из рабочего пространства' }));
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить источник' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Со страницы' }), '5');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'По страницу' }), '8');
    await userEvent.type(screen.getByRole('textbox', { name: 'Тема или пожелание' }), 'Сила');
    await userEvent.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось начать генерацию');
    await userEvent.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start.mock.calls[0][0]).toEqual(start.mock.calls[1][0]);
    expect(start.mock.calls[0][0].body).toMatchObject({
      sourceType: 'TEXTBOOK', workspaceItemId: 37, pageFrom: 5, pageTo: 8,
      teacherPrompt: 'Сила', companionKind: 'PLAN', language: 'ru',
    });
    expect(start.mock.calls[0][0].body).not.toHaveProperty('lessonId');
  });

  it('позволяет перенести готовый результат в форму без связи с уроком', async () => {
    overview.mockReturnValue({ data: { aiEnabled: true, remainingCalls: 9, latestJob: {
      status: 'DONE', sourceName: 'Физика 8',
      request: { sourceType: 'TEXTBOOK', workspaceItemId: 37 },
      result: { title: 'Сила', summaryText: 'Конспект', companionText: 'План', companionKind: 'PLAN' },
    } } });
    const onUse = vi.fn();
    const onClose = vi.fn();
    render(<GenerateLessonPreparationModal onClose={onClose} onUse={onUse} />);
    await userEvent.click(screen.getByRole('button', { name: 'Использовать в заготовке' }));
    expect(onUse).toHaveBeenCalledWith(
      { title: 'Сила', summaryText: 'Конспект', companionText: 'План', companionKind: 'PLAN' },
      { id: 37, title: 'Физика 8', type: 'TEXTBOOK' },
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
