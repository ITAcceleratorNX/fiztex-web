import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextbookDetailModal } from './TextbookDetailModal';

const openFile = vi.fn();
const content = vi.fn();
const card = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({ useTeacherTextbookCard: (id: number | null) => card(id) }));
vi.mock('@/lib/textbookFile', () => ({ openTextbookFile: (input: unknown) => openFile(input),
  textbookFileName: (title: string, format: string) => `${title}.${format.toLowerCase()}` }));
vi.mock('@/lib/textbooksApi', () => ({ teacherTextbooksApi: { content: (id: number) => content(id) } }));

const item = { id: 5, title: 'Физика 8 класс', sourceKind: 'teacher-textbook', sourceId: '17' };

beforeEach(() => {
  vi.clearAllMocks();
  card.mockReturnValue({ data: { textbook: { id: 17, title: 'Физика 8 класс', format: 'PDF',
    subjectName: 'Физика', pageCount: 180, status: 'ACTIVE' } }, isPending: false, isError: false });
  openFile.mockResolvedValue(undefined);
});

describe('TextbookDetailModal', () => {
  it('открывает файл выбранного учебника и оставляет возможность вернуться в раздел', async () => {
    const onClose = vi.fn();
    render(<TextbookDetailModal item={item} onClose={onClose} />);
    expect(card).toHaveBeenCalledWith(17);
    expect(screen.getByText('Страниц: 180')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Открыть учебник' }));
    await waitFor(() => expect(openFile).toHaveBeenCalledWith(expect.objectContaining({
      format: 'PDF', fileName: 'Физика 8 класс.pdf',
    })));
    const { load } = openFile.mock.calls[0][0];
    load();
    expect(content).toHaveBeenCalledWith(17);
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('не открывает заблокированный учебник', () => {
    card.mockReturnValue({ data: { textbook: { format: 'PDF', status: 'BLOCKED' } }, isPending: false, isError: false });
    render(<TextbookDetailModal item={item} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Открыть учебник' })).toBeDisabled();
    expect(screen.getByText('Учебник недоступен для просмотра')).toBeInTheDocument();
  });
});
