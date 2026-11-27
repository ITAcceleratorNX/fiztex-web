import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyAccessGrant } from '@/lib/studyAccessApi';
import { TeacherStudyAccessCard } from './TeacherStudyAccessCard';

const useTeacherStudyAccess = vi.fn();
const revoke = vi.fn();
const success = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success, error: vi.fn() }) }));
vi.mock('@/hooks/queries', () => ({
  useTeacherStudyAccess: (...args: unknown[]) => useTeacherStudyAccess(...args),
  useRevokeStudyAccessGrant: () => ({ mutateAsync: revoke, isPending: false }),
}));
// Шторка проверяется отдельно: здесь важно только, что она открывается нужным режимом.
vi.mock('./StudyAccessGrantDrawer', () => ({
  StudyAccessGrantDrawer: ({ mode }: { mode: { kind: string } }) => <div role="dialog">шторка: {mode.kind}</div>,
}));

const active: StudyAccessGrant = {
  id: 1,
  state: 'ACTIVE',
  sections: ['ATTENDANCE', 'GRADES'],
  academicYear: { id: 3, name: '2026/2027', current: true },
  scope: { type: 'CLASSES', classes: [{ id: 11, name: '8А' }, { id: 12, name: '8Б' }] },
  validUntil: '2027-05-31',
  daysLeft: 189,
  retainedElsewhere: 'NONE',
};
const revoked: StudyAccessGrant = {
  id: 2,
  state: 'REVOKED',
  sections: ['ATTENDANCE'],
  academicYear: { id: 3, name: '2026/2027', current: true },
  scope: { type: 'CLASSES', classes: [{ id: 6, name: '6А' }] },
  validUntil: '2026-10-31',
  endedOn: '2026-11-23',
};

function respond(data: { active: StudyAccessGrant[]; ended: StudyAccessGrant[] }) {
  useTeacherStudyAccess.mockReturnValue({
    isPending: false,
    isError: false,
    data: { ...data, teacher: { fullName: 'Сапарова Айгерим Кайратовна', accountStatus: 'ACTIVE' } },
    refetch: vi.fn(),
  });
}

function renderCard(canGrant = true) {
  return render(<TeacherStudyAccessCard teacherProfileId={4} teacherName="Сапарова Айгерим Кайратовна" canGrant={canGrant} />);
}

describe('TeacherStudyAccessCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revoke.mockResolvedValue({});
  });

  it('пустое состояние с выдачей (А1)', async () => {
    respond({ active: [], ended: [] });
    renderCard();

    expect(screen.getByText(/Дополнительных прав нет\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Предоставить доступ' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('шторка: create');
  });

  it('ошибка загрузки — текст сервера и повтор', async () => {
    const refetch = vi.fn();
    useTeacherStudyAccess.mockReturnValue({ isPending: false, isError: true, error: new Error('Нет связи с сервером'), refetch });
    renderCard();

    expect(screen.getByText('Нет связи с сервером')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Повторить/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('строка права: разделы, область, год, срок и остаток (А6)', () => {
    respond({ active: [active], ended: [] });
    renderCard();

    const row = screen.getAllByRole('row')[1]!;
    expect(within(row).getByText('Оценки')).toBeInTheDocument();
    expect(within(row).getByText('Посещаемость')).toBeInTheDocument();
    expect(within(row).getByText('8А, 8Б')).toBeInTheDocument();
    expect(within(row).getByText('до 31.05.2027')).toBeInTheDocument();
    expect(within(row).getByText('· ещё 6 мес.')).toBeInTheDocument();
  });

  it('нет действующих — пояснение и раскрытая история с «Выдать снова» (А13)', async () => {
    respond({ active: [], ended: [revoked] });
    renderCard();

    expect(screen.getByText('Сейчас действующих прав нет — учитель видит только свои классы.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Истёкшие и отозванные · 1/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('· 23.11.2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Выдать снова' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('шторка: reissue');
  });

  it('при действующих история свёрнута', () => {
    respond({ active: [active], ended: [revoked] });
    renderCard();

    expect(screen.getByRole('button', { name: /Истёкшие и отозванные · 1/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Выдать снова')).not.toBeInTheDocument();
  });

  it('отзыв: подтверждение с областью записи, потом тост (А11–А12)', async () => {
    respond({ active: [active], ended: [] });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /Действия с правом/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
    expect(screen.getByText(/Сапарова А\.К\. перестанет видеть/)).toBeInTheDocument();
    expect(screen.getByText('оценки и посещаемость 8А, 8Б')).toBeInTheDocument();

    const dialog = screen.getByText(/перестанет видеть/).closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отозвать' }));
    expect(revoke).toHaveBeenCalledWith(1);
    expect(success).toHaveBeenCalledWith('Основная роль и классы учителя не изменились', 'Доступ отозван');
  });

  it('заблокированному учителю права не выдаются', () => {
    respond({ active: [], ended: [revoked] });
    renderCard(false);

    expect(screen.queryByText('+ Предоставить доступ')).not.toBeInTheDocument();
    expect(screen.queryByText('Выдать снова')).not.toBeInTheDocument();
  });
});
