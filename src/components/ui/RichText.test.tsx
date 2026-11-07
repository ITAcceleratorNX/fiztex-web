import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RichText } from './RichText';
import { embedToken, type ContentEmbed } from '@/lib/contentEmbeds';

const IMAGE = '3f2a9c1e-5b7d-4e8a-9f1c-2d3e4f5a6b7c';
const FILE = '0b8d2e47-1c3a-4f59-8e6d-7a9b0c1d2e3f';

const embeds: ContentEmbed[] = [
  { id: IMAGE, kind: 'IMAGE', available: true, fileName: 'Схема.png', extension: 'png', contentType: 'image/png',
    sizeBytes: 2048, width: 800, height: 400, url: 'https://files/schema-display', originalUrl: 'https://files/schema',
    downloadUrl: 'https://files/schema?download' },
  { id: FILE, kind: 'FILE', available: true, fileName: 'Задачи.docx', extension: 'docx',
    contentType: 'application/msword', sizeBytes: 4096, url: 'https://files/tasks?download',
    downloadUrl: 'https://files/tasks?download' },
];

describe('RichText', () => {
  it('рисует текст, рисунок и файл в том порядке, что в тексте, и не показывает маркеров', () => {
    const text = `Первый абзац\n${embedToken('image', IMAGE)}\nВторой абзац\n${embedToken('file', FILE)}`;
    const { container } = render(<RichText text={text} embeds={embeds} />);

    const content = container.textContent ?? '';
    expect(content.indexOf('Первый абзац')).toBeLessThan(content.indexOf('Второй абзац'));
    expect(content.indexOf('Второй абзац')).toBeLessThan(content.indexOf('Задачи.docx'));
    expect(content).not.toContain('[[');
    expect(screen.getByRole('img', { name: 'Схема.png' })).toHaveAttribute('src', 'https://files/schema-display');
    // Word браузер не покажет — его скачивают под своим именем.
    expect(screen.getByRole('link', { name: /Скачать/ })).toHaveAttribute('href', 'https://files/tasks?download');
  });

  it('увеличение открывает оригинал поверх страницы', () => {
    render(<RichText text={embedToken('image', IMAGE)} embeds={embeds} />);

    fireEvent.click(screen.getByRole('button', { name: /Увеличить рисунок/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://files/schema');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('вставка без описания — «недоступен», а не сырой маркер', () => {
    const text = `${embedToken('image', FILE)}\n${embedToken('file', '11111111-2222-4333-8444-555555555555')}`;
    const { container } = render(<RichText text={text} embeds={[]} />);

    expect(screen.getByText('Рисунок недоступен')).toBeInTheDocument();
    expect(screen.getByText('Файл недоступен')).toBeInTheDocument();
    expect(container.textContent).not.toContain('[[');
  });

  it('текст без вставок выводится как раньше — одним текстом', () => {
    const { container } = render(<RichText text="Просто текст" textClassName="text-sm" />);
    expect(container.firstChild).toHaveTextContent('Просто текст');
    expect(container.querySelectorAll('div')).toHaveLength(0);
  });
});
