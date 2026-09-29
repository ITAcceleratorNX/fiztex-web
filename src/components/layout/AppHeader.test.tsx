import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { ScheduleBreadcrumbs } from '@/platform/pages/schedule/ScheduleBreadcrumbs';

const scheduleSubpages = [
  ['/lesson-schedule/bell-templates', 'Шаблоны звонков'],
  ['/lesson-schedule/calendar', 'Школьный календарь'],
  ['/lesson-schedule/teachers', 'Занятость учителей'],
  ['/lesson-schedule/subgroups', 'Подгруппы классов'],
] as const;

describe('AppHeader page heading ownership', () => {
  it.each(scheduleSubpages)('%s has one page-owned H1', (path, title) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppHeader />
        <ScheduleBreadcrumbs current={title} />
      </MemoryRouter>,
    );

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(title);
  });

  it('keeps the shared H1 on the schedule overview', () => {
    render(
      <MemoryRouter initialEntries={['/lesson-schedule']}>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Расписание', level: 1 })).toBeInTheDocument();
  });
});
