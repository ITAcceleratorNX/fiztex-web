import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonSummaryGenerateModal, validatePages } from './LessonSummaryGenerateModal';

const start = vi.fn();
const upload = vi.fn();
const source = vi.fn();
const selected = { textbookId: 7, title: 'Физика', pageFrom: 45, pageTo: 47 };
vi.mock('@/hooks/queries', () => ({
  useLessonTextbooks: () => ({ data: { selected, available: [] } }),
  useLessonMaterials: () => ({ data: [] }),
  useSummaryLibrary: () => ({ data: { pages: [] } }),
  useSummarySource: (...args: unknown[]) => source(...args),
  useUploadSummarySource: () => ({ mutateAsync: upload }),
  useSummaryCommands: () => ({ start: { mutateAsync: start } }),
}));

describe('Источник конспекта', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    source.mockImplementation((_id, _type, sourceId) => ({
      data: sourceId ? { pageNavigation: true, pageCount: 100, maxPages: 30 } : undefined,
    }));
    start.mockResolvedValue({});
  });
  it('подставляет страницы урока, передаёт их в запрос и сохраняет ключ при сетевом повторе', async () => {
    const user = userEvent.setup();
    start.mockRejectedValueOnce(new Error('network'));
    const close = vi.fn();
    render(<LessonSummaryGenerateModal lesson={{ id: 1, subjectId: 2, topic: 'Плотность' }} companionKind="PLAN" onClose={close} />);
    expect(await screen.findByLabelText('Со страницы')).toHaveValue(45);
    expect(screen.getByLabelText('По страницу')).toHaveValue(47);
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(start.mock.calls[0][0]).toEqual(start.mock.calls[1][0]);
    expect(start.mock.calls[0][0].body).toMatchObject({
      sourceType: 'TEXTBOOK', sourceId: 7, pageFrom: 45, pageTo: 47, companionKind: 'PLAN', teacherPrompt: 'Плотность',
    });
  });
  it('загружает файл один раз и использует полученный материал для генерации', async () => {
    const user = userEvent.setup();
    upload.mockResolvedValue({ id: 22 });
    source.mockImplementation((_id, _type, id) => ({ data: id ? { pageNavigation: false } : undefined }));
    const { container } = render(<LessonSummaryGenerateModal lesson={{ id: 1 }} companionKind="RETELLING" onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Загрузить файл' }));
    const file = new File(['Текст урока'], 'lesson.txt', { type: 'text/plain' });
    await user.upload(container.querySelector('input[type=file]') as HTMLInputElement, file);
    await waitFor(() => expect(upload).toHaveBeenCalledWith(file));
    await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));
    expect(start.mock.calls[0][0].body).toMatchObject({ sourceType: 'LESSON_MATERIAL', sourceId: 22 });
    expect(start.mock.calls[0][0].body.pageFrom).toBeUndefined();
  });
  it('требует диапазон для большого PDF и не пропускает некорректные страницы', () => {
    expect(validatePages('', '', 100, 30)).not.toBe('');
    expect(validatePages('45', '47', 100, 30)).toBe('');
    expect(validatePages('45', '', 100, 30)).toBe('');
    for (const [from, to] of [['0', '2'], ['3', '2'], ['1', '31'], ['1.5', '3'], ['', '7'], ['90', '101']]) {
      expect(validatePages(from, to, 100, 30)).not.toBe('');
    }
  });
});
