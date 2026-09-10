import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const role = vi.fn(() => 'TEACHER');

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ admin: { role: role(), fullName: 'Искаков Алишер' }, logout: vi.fn() }),
}));

function renderSidebar(path = '/homework') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

function nav() {
  return screen.getByRole('navigation');
}

describe('Sidebar — свёрнутое состояние', () => {
  beforeEach(() => {
    localStorage.clear();
    role.mockReturnValue('TEACHER');
  });

  it('по умолчанию развёрнут: у пунктов видны подписи', () => {
    renderSidebar();

    expect(within(nav()).getByText('Текущий урок')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть меню' })).toBeInTheDocument();
  });

  it('сворачивается и разворачивается одной кнопкой', async () => {
    renderSidebar();

    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    // Подписи исчезли, но пункты остались доступны — по имени из aria-label.
    expect(within(nav()).queryByText('Текущий урок')).not.toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: 'Текущий урок' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Развернуть меню' }));
    expect(within(nav()).getByText('Текущий урок')).toBeInTheDocument();
  });

  it('состояние переживает перезагрузку', async () => {
    const { unmount } = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    expect(localStorage.getItem('fiztex.sidebar.collapsed')).toBe('1');
    unmount();

    renderSidebar();
    expect(screen.getByRole('button', { name: 'Развернуть меню' })).toBeInTheDocument();
  });

  it('свёрнутая панель не теряет ни одного пункта роли', async () => {
    renderSidebar();
    const expanded = within(nav()).getAllByRole('link').map((link) => link.getAttribute('href'));

    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    const collapsed = within(nav()).getAllByRole('link').map((link) => link.getAttribute('href'));

    expect(collapsed).toEqual(expanded);
  });

  it('вложенные пункты в свёрнутой панели не показываются — от них остался бы один значок', async () => {
    role.mockReturnValue('SUPER_ADMIN');
    renderSidebar('/admin/users');

    // Развёрнутая ветка «Пользователи» открыта на своём маршруте.
    expect(within(nav()).getByRole('link', { name: 'Ученики' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));

    expect(within(nav()).queryByRole('link', { name: 'Ученики' })).not.toBeInTheDocument();
    // Сам раздел при этом остаётся кликабельным.
    expect(within(nav()).getByRole('link', { name: 'Пользователи' })).toBeInTheDocument();
  });

  it('свёрнутый рельс показывает все пункты, даже когда группы закрыты', async () => {
    // Это и есть смысл рельса: быстрый переход «всё сразу». Аккордеон прячет пункты в
    // широкой панели ради высоты, но узкая полоса вмещает их и без подписей.
    role.mockReturnValue('SUPER_ADMIN');
    renderSidebar('/dashboard');

    // В широкой панели группа закрыта — её пунктов нет.
    expect(within(nav()).queryByRole('link', { name: 'Классы' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));

    expect(within(nav()).getByRole('link', { name: 'Классы' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: 'Вступительные тесты' })).toBeInTheDocument();
  });

  it('наведение на рельс возвращает подписи, не разжимая панель в раскладке', async () => {
    role.mockReturnValue('TEACHER');
    renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));

    const panel = screen.getByRole('complementary');
    const spacer = panel.parentElement as HTMLElement;
    expect(within(nav()).queryByText('Расписание')).not.toBeInTheDocument();

    fireEvent.mouseEnter(panel);
    expect(within(nav()).getByText('Расписание')).toBeInTheDocument();
    // Распорка осталась узкой — страница под панелью не сдвинулась.
    expect(spacer.className).toContain('w-[72px]');
    expect(panel.className).toContain('w-[220px]');

    fireEvent.mouseLeave(panel);
    expect(within(nav()).queryByText('Расписание')).not.toBeInTheDocument();
  });

  it('выход из панели доступен и в свёрнутом виде', async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));

    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  });
});

describe('Sidebar — группы-аккордеон', () => {
  beforeEach(() => {
    localStorage.clear();
    role.mockReturnValue('SUPER_ADMIN');
  });

  it('закрытая группа показывает число пунктов вместо самих пунктов', () => {
    renderSidebar('/dashboard');

    const group = screen.getByRole('button', { name: /Platform Core/i });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    // Число — единственное, что закрытая группа может сказать о себе.
    expect(within(group).getByText('7')).toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: 'Классы' })).not.toBeInTheDocument();
  });

  it('клик по заголовку открывает группу', async () => {
    renderSidebar('/dashboard');

    await userEvent.click(screen.getByRole('button', { name: /Platform Core/i }));

    expect(within(nav()).getByRole('link', { name: 'Классы' })).toBeInTheDocument();
  });

  it('переход в раздел открывает его группу сам', () => {
    renderSidebar('/admissions');

    expect(within(nav()).getByRole('link', { name: 'Вступительные тесты' })).toBeInTheDocument();
    // Соседняя группа при этом остаётся закрытой — иначе меню снова не поместится.
    expect(within(nav()).queryByRole('link', { name: 'Классы' })).not.toBeInTheDocument();
  });

  it('открытая группа запоминается между заходами', async () => {
    const { unmount } = renderSidebar('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: /Учебный процесс/i }));
    unmount();

    renderSidebar('/dashboard');
    expect(within(nav()).getByRole('link', { name: 'Журнал оценок' })).toBeInTheDocument();
  });

  it('у учителя групп нет — его меню не складывается', () => {
    role.mockReturnValue('TEACHER');
    renderSidebar();

    expect(screen.queryByRole('button', { name: /Platform Core/i })).not.toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: 'Расписание' })).toBeInTheDocument();
  });
});
