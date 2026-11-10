import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeacherRequest } from '@/lib/teacherRequestsApi';
import { RequestDetailHeader } from './RequestDetailPage';

function request(status: 'APPROVED' | 'REJECTED'): TeacherRequest {
  return {
    status,
    type: 'RELEASE',
    dateFrom: '2026-11-02',
    dateTo: '2026-11-02',
  } as TeacherRequest;
}

describe('RequestDetailHeader', () => {
  it('matches the approved teacher request header and shows the locked notice', () => {
    render(<RequestDetailHeader request={request('APPROVED')} admin={false} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Освобождение' })).toBeInTheDocument();
    expect(screen.getByText('Согласована')).toBeInTheDocument();
    expect(screen.getByText('2 ноября 2026')).toBeInTheDocument();
    expect(screen.getByText('1 день')).toBeInTheDocument();
    expect(screen.getByText('Заявка согласована, даты и причину изменить нельзя. Документы можно добавлять в любой момент.')).toBeInTheDocument();
  });

  it('matches the rejected state without the approved notice', () => {
    render(<RequestDetailHeader request={request('REJECTED')} admin={false} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Освобождение' })).toBeInTheDocument();
    expect(screen.getByText('Отклонена')).toBeInTheDocument();
    expect(screen.getByText('2 ноября 2026')).toBeInTheDocument();
    expect(screen.getByText('1 день')).toBeInTheDocument();
    expect(screen.queryByText(/даты и причину изменить нельзя/)).not.toBeInTheDocument();
  });
});
