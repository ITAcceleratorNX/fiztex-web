import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeacherRequest } from '@/lib/teacherRequestsApi';
import { RequestDetailHeader, TeacherRequestActionBar } from './RequestDetailPage';

function request(status: 'APPROVED' | 'REJECTED' | 'CANCELLED'): TeacherRequest {
  return {
    status,
    type: 'RELEASE',
    teacherName: 'Марина Демо',
    dateFrom: status === 'CANCELLED' ? '2026-10-27' : '2026-11-02',
    dateTo: status === 'CANCELLED' ? '2026-10-27' : '2026-11-02',
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-28', 'sm:text-32');
  });

  it('matches the rejected state without the approved notice', () => {
    render(<RequestDetailHeader request={request('REJECTED')} admin={false} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Освобождение' })).toBeInTheDocument();
    expect(screen.getByText('Отклонена')).toBeInTheDocument();
    expect(screen.getByText('2 ноября 2026')).toBeInTheDocument();
    expect(screen.getByText('1 день')).toBeInTheDocument();
    expect(screen.queryByText(/даты и причину изменить нельзя/)).not.toBeInTheDocument();
  });

  it('uses the separate admin header layout and shows the cancelled request notice', () => {
    render(<RequestDetailHeader request={request('CANCELLED')} admin onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Марина Демо' })).toHaveClass('text-28', 'sm:text-32');
    expect(screen.getByText('Отменена')).toBeInTheDocument();
    expect(screen.getByText('Освобождение')).toBeInTheDocument();
    expect(screen.getByText('27 октября 2026')).toBeInTheDocument();
    expect(screen.getByText('1 день')).toBeInTheDocument();
    expect(screen.getByText('Учитель отменил заявку до решения. Рассматривать её не нужно.')).toBeInTheDocument();
  });

  it('shows the admin type chip for rejected requests without the cancelled notice', () => {
    render(<RequestDetailHeader request={request('REJECTED')} admin onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Марина Демо' })).toBeInTheDocument();
    expect(screen.getByText('Отклонена')).toBeInTheDocument();
    expect(screen.getByText('Освобождение')).toBeInTheDocument();
    expect(screen.queryByText(/Учитель отменил заявку/)).not.toBeInTheDocument();
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
    expect(buttons[0]).toHaveClass('h-11', 'text-sm', '!text-navy-700', '!ring-navy-700');
    expect(buttons[1]).toHaveClass('h-11', 'text-sm', '!text-navy-700', '!ring-navy-700');
    expect(buttons[2]).toHaveClass('h-11', 'text-sm', '!text-red-600');
  });
});
