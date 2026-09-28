import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { serviceRequestsApi, type ServiceRequest } from '@/lib/serviceRequestsApi';
import { CreateServiceRequestModal } from './CreateServiceRequestModal';

const createdRequest = { id: 99, requestNumber: 'SR-99', status: 'NEW' } as ServiceRequest;
const NativeRequest = globalThis.Request;

function TestFlow({ onCreated }: { onCreated: (created: ServiceRequest) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <>
      <output data-testid="location">{location.pathname}</output>
      <Link to="/menu">Меню</Link>
      {location.pathname === '/service' && !open && (
        <button type="button" onClick={() => setOpen(true)}>Открыть форму</button>
      )}
      {location.pathname === '/service' && open && (
        <CreateServiceRequestModal
          open
          onClose={() => setOpen(false)}
          onCreated={(created) => {
            onCreated(created);
            navigate(`/service/${created.id}`);
          }}
        />
      )}
    </>
  );
}

function renderFlow(initialEntries = ['/service'], initialIndex?: number) {
  const onCreated = vi.fn();
  const router = createMemoryRouter(
    [{ path: '*', element: <TestFlow onCreated={onCreated} /> }],
    { initialEntries, initialIndex },
  );
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { onCreated, router };
}

async function fillFirstStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Клининг' }));
  await user.type(screen.getByPlaceholderText('Например: Корпус А'), 'Корпус А');
  await user.type(screen.getByPlaceholderText('Например: 3'), '3');
  await user.type(screen.getByPlaceholderText('Например: Каб. 204 или Спортзал'), 'Каб. 204');
  await user.click(screen.getByRole('button', { name: 'Далее' }));
}

async function fillValidRequest(user: ReturnType<typeof userEvent.setup>, description = 'Не работает свет') {
  await fillFirstStep(user);
  await user.type(screen.getByPlaceholderText('Опишите проблему подробнее…'), description);
}

describe('CreateServiceRequestModal — защита незавершённой заявки (UX-08)', () => {
  let createRequest: MockInstance<typeof serviceRequestsApi.create>;

  beforeEach(() => {
    vi.stubGlobal('Request', class CrossRealmSafeRequest extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        const { signal: _signal, ...safeInit } = init ?? {};
        super(input, safeInit);
      }
    });
    createRequest = vi.spyOn(serviceRequestsApi, 'create').mockResolvedValue(createdRequest);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['Отмена', 'Escape', 'крестик', 'фон'] as const)(
    '%s закрытие предлагает остаться или отказаться от заполненной формы',
    async (method) => {
      const user = userEvent.setup();
      renderFlow();
      await user.type(screen.getByPlaceholderText('Например: Корпус А'), 'Корпус А');

      if (method === 'Отмена') {
        await user.click(screen.getByRole('button', { name: 'Отмена' }));
      } else if (method === 'Escape') {
        await user.keyboard('{Escape}');
      } else if (method === 'крестик') {
        const mainDialog = screen.getAllByRole('dialog')[0];
        await user.click(within(mainDialog).getAllByRole('button')[0]);
      } else {
        const backdrop = Array.from(document.querySelectorAll('div.fixed.inset-0'))
          .find((element) => element.className.includes('backdrop-blur-sm'));
        expect(backdrop).toBeTruthy();
        fireEvent.click(backdrop!);
      }

      expect(await screen.findByRole('heading', { name: 'Закрыть заявку без сохранения?' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Остаться' }));
      expect(screen.getByPlaceholderText('Например: Корпус А')).toHaveValue('Корпус А');
      expect(screen.getByTestId('location')).toHaveTextContent('/service');
    },
  );

  it('закрывает чистую форму сразу, а явный отказ закрывает грязную', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('heading', { name: 'Создать заявку' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Открыть форму' }));
    await user.type(screen.getByPlaceholderText('Например: Корпус А'), 'Корпус А');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Выйти без сохранения' }));
    expect(screen.queryByRole('heading', { name: 'Создать заявку' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Открыть форму' }));
    expect(screen.getByPlaceholderText('Например: Корпус А')).toHaveValue('');
  });

  it('блокирует переход по меню и Back, пока пользователь не выберет действие', async () => {
    const user = userEvent.setup();
    const { router } = renderFlow(['/previous', '/service'], 1);
    await user.type(screen.getByPlaceholderText('Например: Корпус А'), 'Корпус А');

    await router.navigate(-1);
    expect(await screen.findByRole('heading', { name: 'Закрыть заявку без сохранения?' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/service');
    await user.click(screen.getByRole('button', { name: 'Остаться' }));

    await router.navigate('/menu');
    expect(await screen.findByRole('heading', { name: 'Закрыть заявку без сохранения?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Выйти без сохранения' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/menu'));
  });

  it('не закрывает форму и блокирует повторную отправку, пока запрос выполняется', async () => {
    const user = userEvent.setup();
    let resolveRequest!: (request: ServiceRequest) => void;
    createRequest.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const { onCreated } = renderFlow();
    await fillValidRequest(user);

    const submit = screen.getByRole('button', { name: 'Создать заявку' });
    await user.dblClick(submit);
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Отправляем заявку/)).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(screen.getByPlaceholderText('Опишите проблему подробнее…')).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(await screen.findByRole('heading', { name: 'Заявка отправляется' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Остаться' }));
    expect(screen.getByPlaceholderText('Опишите проблему подробнее…')).toHaveValue('Не работает свет');

    resolveRequest(createdRequest);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdRequest));
    expect(screen.getByTestId('location')).toHaveTextContent('/service/99');
  });

  it('показывает ошибку и оставляет значения для повторной отправки', async () => {
    const user = userEvent.setup();
    createRequest.mockRejectedValueOnce(new Error('Сеть недоступна'));
    const { onCreated } = renderFlow();
    await fillValidRequest(user, 'Не работает отопление');
    await user.click(screen.getByRole('button', { name: 'Создать заявку' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сеть недоступна');
    expect(screen.getByPlaceholderText('Опишите проблему подробнее…')).toHaveValue('Не работает отопление');
    expect(screen.getByTestId('location')).toHaveTextContent('/service');

    await user.click(screen.getByRole('button', { name: 'Создать заявку' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdRequest));
    expect(createRequest).toHaveBeenCalledTimes(2);
  });

  it('предупреждает браузер перед перезагрузкой незавершённой формы', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByPlaceholderText('Например: Корпус А'), 'Корпус А');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
