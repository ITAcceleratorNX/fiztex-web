import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, pageWindow } from './Pagination';

const FORMS: [string, string, string] = ['заявки', 'заявок', 'заявок'];

describe('pageWindow', () => {
  it('до семи страниц показывает все', () => {
    expect(pageWindow(0, 1)).toEqual([0]);
    expect(pageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('держит семь мест и не прячет за пропуском одну страницу', () => {
    expect(pageWindow(0, 10)).toEqual([0, 1, 2, 3, 4, 'gap', 9]);
    expect(pageWindow(3, 10)).toEqual([0, 1, 2, 3, 4, 'gap', 9]);
    expect(pageWindow(4, 10)).toEqual([0, 'gap', 3, 4, 5, 'gap', 9]);
    expect(pageWindow(5, 10)).toEqual([0, 'gap', 4, 5, 6, 'gap', 9]);
    expect(pageWindow(6, 10)).toEqual([0, 'gap', 5, 6, 7, 8, 9]);
    expect(pageWindow(9, 10)).toEqual([0, 'gap', 5, 6, 7, 8, 9]);
  });
});

describe('Pagination', () => {
  it('одну страницу не рисует', () => {
    const { container } = render(
      <Pagination page={0} totalPages={1} totalElements={6} pageSize={25} itemForms={FORMS} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('показывает диапазон, отмечает текущую страницу и листает', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalPages={3}
        totalElements={61}
        pageSize={25}
        itemForms={FORMS}
        label="Страницы заявок"
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Страницы заявок' })).toBeInTheDocument();
    expect(screen.getByText('26–50 из 61 заявки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Страница 2' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Страница 3' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    await user.click(screen.getByRole('button', { name: 'Предыдущая страница' }));
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    await user.click(screen.getByRole('button', { name: 'Страница 2' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it('на краях выключает стрелку', () => {
    render(
      <Pagination page={2} totalPages={3} totalElements={61} pageSize={25} itemForms={FORMS} onPageChange={() => {}} />,
    );
    expect(screen.getByText('51–61 из 61 заявки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Следующая страница' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Предыдущая страница' })).toBeEnabled();
  });
});
