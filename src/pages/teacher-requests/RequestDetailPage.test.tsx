import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeacherRequest } from '@/lib/teacherRequestsApi';
import { RequestDetailHeader, TeacherRequestActionBar } from './RequestDetailPage';

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

describe('TeacherRequestActionBar', () => {
  it('keeps adding a document beside editing and cancellation in the sticky footer', () => {
    render(<TeacherRequestActionBar
      admin={false}
      actions={['EDIT', 'UPLOAD_DOCUMENT', 'CANCEL']}
      busy={false}
      inputRef={createRef<HTMLInputElement>()}
      onFile={vi.fn()}
      onUploadClick={vi.fn()}
      onEdit={vi.fn()}
      onCancel={vi.fn()}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />);

    const footer = screen.getByRole('contentinfo');
    const buttons = within(footer).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Редактировать',
      'Добавить документ',
      'Отменить заявку',
    ]);
    expect(buttons[0]).toHaveClass('h-14', '!rounded-2xl', '!text-navy-700', '!ring-navy-700');
    expect(buttons[1]).toHaveClass('h-14', '!rounded-2xl', '!text-navy-700', '!ring-navy-700');
    expect(buttons[2]).toHaveClass('h-14', '!rounded-2xl', '!text-lg', '!text-red-600');
  });
});
