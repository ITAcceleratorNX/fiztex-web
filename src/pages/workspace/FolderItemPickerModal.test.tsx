import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderItemPickerModal } from './FolderItemPickerModal';

const attach = vi.fn();
const search = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn() }),
}));
vi.mock('@/hooks/queries', () => ({
  useTeacherWorkspaceSearch: (...args: unknown[]) => search(...args),
  useAttachWorkspaceFolderItem: () => ({ mutateAsync: attach }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  attach.mockResolvedValue(undefined);
  search.mockReturnValue({ isPending: false, isError: false, data: { items: { content: [
    { id: 11, title: 'Уже в папке', type: 'DOCUMENT', folders: [{ id: 4 }] },
    { id: 12, title: 'Доступный тест', type: 'TEST', folders: [] },
  ], totalPages: 1 } } });
});

describe('FolderItemPickerModal', () => {
  it('показывает существующие связи и прикрепляет другой тип материала к папке', async () => {
    const onClose = vi.fn();
    render(<FolderItemPickerModal folderId={4} onClose={onClose} />);
    expect(screen.getByRole('checkbox', { name: /Уже в папке/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /Доступный тест/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить (1)' }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith({ folderId: 4, itemId: 12 }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
