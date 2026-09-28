import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { SegmentedTabs } from './SegmentedTabs';

describe('Tabs', () => {
  it('switches and wraps with arrows, skips disabled tabs, and supports Home/End', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Tabs defaultValue="today" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="today">Сегодня</TabsTrigger>
          <TabsTrigger value="disabled" disabled>Недоступно</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
        <TabsContent value="today">Текущие заявки</TabsContent>
        <TabsContent value="disabled">Недоступная панель</TabsContent>
        <TabsContent value="history">История заявок</TabsContent>
      </Tabs>,
    );

    const today = screen.getByRole('tab', { name: 'Сегодня' });
    const history = screen.getByRole('tab', { name: 'История' });
    expect(today).toHaveAttribute('tabindex', '0');
    expect(history).toHaveAttribute('tabindex', '-1');
    expect(history).not.toHaveAttribute('aria-controls');

    today.focus();
    await user.keyboard('{ArrowRight}');
    expect(history).toHaveFocus();
    expect(history).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange).toHaveBeenLastCalledWith('history');

    await user.keyboard('{End}');
    expect(history).toHaveFocus();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.keyboard('{ArrowRight}');
    expect(today).toHaveFocus();
    expect(today).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(today).toHaveFocus();
  });

  it('connects the selected tab to a focusable panel and keeps Tab inside the page flow', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Мои заявки</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">Список заявок</TabsContent>
        <TabsContent value="history">История заявок</TabsContent>
      </Tabs>,
    );

    const selectedTab = screen.getByRole('tab', { name: 'Мои заявки' });
    const panel = screen.getByRole('tabpanel');
    expect(selectedTab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', selectedTab.id);

    selectedTab.focus();
    await user.tab();
    expect(panel).toHaveFocus();
  });

});

describe('SegmentedTabs', () => {
  it('exposes a radio group, uses roving keyboard navigation, and skips disabled segments', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        ariaLabel="Окно журнала"
        value="month"
        onChange={onChange}
        options={[
          { value: 'month', label: 'Месяц' },
          { value: 'disabled', label: 'Недоступно', disabled: true },
          { value: 'period', label: 'Четверть' },
        ]}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'Окно журнала' });
    const month = screen.getByRole('radio', { name: 'Месяц' });
    const period = screen.getByRole('radio', { name: 'Четверть' });
    expect(group).toHaveAttribute('aria-orientation', 'horizontal');
    expect(month).toHaveAttribute('aria-checked', 'true');
    expect(month).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Недоступно' })).toBeDisabled();
    month.focus();
    await user.keyboard('{Home}');
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{ArrowRight}');

    expect(period).toHaveFocus();
    expect(period).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenCalledWith('period');
  });
});
