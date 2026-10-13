import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ClassDetailPage } from './ClassDetailPage';

const api = vi.hoisted(() => ({
  getClass: vi.fn(), listAcademicYears: vi.fn(), listStudents: vi.fn(), archiveClass: vi.fn(),
}));

vi.mock('../services', () => api);
vi.mock('../components/HomeroomAssignmentCard', () => ({
  HomeroomAssignmentCard: () => <div>Управление руководителем доступно</div>,
}));
vi.mock('../modals/ClassFormModal', () => ({ ClassFormModal: () => null }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const schoolClass = {
  id: '2', name: '5Б', academicYearId: '1', academicYearName: '',
  studentCount: 1, status: 'ACTIVE', createdAt: '2026-10-07T09:00:00Z',
};

function show() {
  render(<MemoryRouter initialEntries={['/admin/classes/2']}>
    <Routes><Route path="/admin/classes/:classId" element={<ClassDetailPage />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getClass.mockResolvedValue(schoolClass);
  api.listAcademicYears.mockResolvedValue([{ id: '1', name: '2026/2027', status: 'ACTIVE' }]);
  api.listStudents.mockResolvedValue([]);
});

describe('ClassDetailPage failure isolation', () => {
  it('keeps homeroom management available if the roster request fails, then retries', async () => {
    api.listStudents.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{
      id: 7, accountId: 31, firstName: 'Айдар', lastName: 'Байтурсынов',
      middleName: null, birthDate: null, accountStatus: 'ACTIVE',
    }]);
    const user = userEvent.setup();
    show();

    expect(await screen.findByText('Управление руководителем доступно')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить данные класса.');
    expect(screen.queryByText('В классе пока нет учеников')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByText('Байтурсынов Айдар')).toBeInTheDocument();
    expect(api.listStudents).toHaveBeenCalledTimes(2);
  });

  it('keeps the page usable if the academic-year list fails', async () => {
    api.listAcademicYears.mockRejectedValue(new Error('offline'));
    show();

    expect(await screen.findByText('Управление руководителем доступно')).toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить учебный год.')).toBeInTheDocument();
  });

  it('reports a class API failure instead of claiming that the class does not exist', async () => {
    api.getClass.mockRejectedValue(new ApiError(500, 'Сервис временно недоступен'));
    show();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Сервис временно недоступен'));
    expect(screen.queryByText('Управление руководителем доступно')).not.toBeInTheDocument();
    expect(screen.queryByText('Класс не найден')).not.toBeInTheDocument();
  });
});
