import { render, screen } from '@testing-library/react';
import { Eye } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { StatusNotice } from './StatusNotice';
import { SegmentedTabs } from './SegmentedTabs';

describe('StatusNotice', () => {
  it('тон navy — спокойное пояснение, а не тревога', () => {
    render(<StatusNotice tone="navy" icon={Eye}>Только просмотр.</StatusNotice>);

    const notice = screen.getByRole('status');
    expect(notice.className).toContain('bg-navy-50');
    expect(notice.querySelector('svg')).toHaveClass('lucide-eye');
  });

  it('тон invalid объявляется сразу, как ошибка', () => {
    render(<StatusNotice tone="invalid">Проверьте отмеченные поля</StatusNotice>);

    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте отмеченные поля');
  });
});

describe('SegmentedTabs block', () => {
  it('растягивает дорожку на всю ширину и красит выбранный сегмент в navy', () => {
    render(
      <SegmentedTabs
        appearance="block"
        ariaLabel="Область доступа"
        value="CLASSES"
        onChange={() => {}}
        options={[{ value: 'CLASSES', label: 'Классы' }, { value: 'SCHOOL', label: 'Вся школа' }]}
      />,
    );

    expect(screen.getByRole('radiogroup')).toHaveClass('w-full');
    expect(screen.getByRole('radio', { name: 'Классы' })).toHaveClass('bg-navy-700', 'flex-1');
    expect(screen.getByRole('radio', { name: 'Вся школа' })).toHaveClass('flex-1');
  });
});

describe('Badge tag', () => {
  it('плоская плашка своего тона и кегля', async () => {
    const { Badge } = await import('./Badge');
    render(<Badge appearance="tag" tone="navy" size="md">Оценки</Badge>);
    expect(screen.getByText('Оценки')).toHaveClass('bg-navy-50', 'text-navy-700', 'text-13', 'rounded-md');
  });
});
