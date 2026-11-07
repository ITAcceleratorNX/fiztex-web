import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RichTextField } from './RichTextField';
import { ContentEmbedServicesProvider, type ContentEmbedServices } from '@/context/ContentEmbedContext';
import { embedToken, type ContentEmbed, type ContentEmbedPolicy } from '@/lib/contentEmbeds';
import { ApiError } from '@/lib/api';

const A = '3f2a9c1e-5b7d-4e8a-9f1c-2d3e4f5a6b7c';
const B = '0b8d2e47-1c3a-4f59-8e6d-7a9b0c1d2e3f';
const C = '11111111-2222-4333-8444-555555555555';

const policy: ContentEmbedPolicy = {
  enabled: true,
  maxEmbedsPerField: 20,
  image: { maxBytes: 10 * 1024 * 1024, extensions: ['jpeg', 'jpg', 'png', 'webp'] },
  file: { maxBytes: 50 * 1024 * 1024, extensions: ['docx', 'pdf'] },
};

const image = (id: string, name = 'Схема.png'): ContentEmbed => ({
  id, kind: 'IMAGE', available: true, fileName: name, extension: 'png', contentType: 'image/png',
  width: 200, height: 100, url: `https://files/${id}`, originalUrl: `https://files/${id}?original`,
  downloadUrl: `https://files/${id}?download`,
});

function setup({ initial, upload, services, embeds = [] }: {
  initial: string;
  upload?: ContentEmbedServices['upload'];
  services?: ContentEmbedServices;
  embeds?: ContentEmbed[];
}) {
  const changes: string[] = [];
  const busy = vi.fn();
  const value = { current: initial };
  function Harness() {
    const [text, setText] = useState(initial);
    return (
      <RichTextField
        ariaLabel="Конспект"
        value={text}
        embeds={embeds}
        maxLength={2000}
        onBusyChange={busy}
        onChange={(next) => {
          changes.push(next);
          value.current = next;
          setText(next);
        }}
      />
    );
  }
  render(
    <ContentEmbedServicesProvider value={services ?? { policy, upload }}>
      <Harness />
    </ContentEmbedServicesProvider>,
  );
  return { changes, busy, value };
}

function putCursor(element: HTMLTextAreaElement, offset: number) {
  element.focus();
  element.setSelectionRange(offset, offset);
  fireEvent.select(element);
}

function pickFile(label: 'Файл рисунка' | 'Файл документа', file: File) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

const png = (name = 'scheme.png') => new File(['png'], name, { type: 'image/png' });

describe('RichTextField', () => {
  it('рисунок встаёт туда, где стоит курсор, — посреди абзаца строка разрезается', async () => {
    const upload = vi.fn().mockResolvedValue(image(A));
    const { value, busy } = setup({ initial: 'Первый абзац', upload });

    putCursor(screen.getByLabelText('Конспект') as HTMLTextAreaElement, 6);
    fireEvent.click(screen.getByRole('button', { name: /Изображение/ }));
    pickFile('Файл рисунка', png());

    await waitFor(() => expect(value.current).toBe(`Первый\n${embedToken('image', A)}\n абзац`));
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'image');
    expect(busy).toHaveBeenNthCalledWith(1, true);
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('img', { name: 'Схема.png' })).toBeInTheDocument();
  });

  it('без курсора — в конец текста', async () => {
    const { value } = setup({ initial: 'Текст', upload: vi.fn().mockResolvedValue(image(A)) });

    pickFile('Файл рисунка', png());

    await waitFor(() => expect(value.current).toBe(`Текст\n${embedToken('image', A)}`));
  });

  it('ошибка загрузки показывает причину и не трогает текст', async () => {
    const upload = vi.fn().mockRejectedValue(new ApiError(400, 'Файл повреждён или не является изображением.'));
    const { changes } = setup({ initial: 'Текст учителя', upload });

    pickFile('Файл рисунка', png());

    expect(await screen.findByRole('alert')).toHaveTextContent('Файл повреждён или не является изображением.');
    expect(changes).toHaveLength(0);
    expect(screen.getByLabelText('Конспект')).toHaveValue('Текст учителя');
  });

  it('неподходящий файл отклоняется до отправки', () => {
    const upload = vi.fn();
    setup({ initial: '', upload });

    pickFile('Файл рисунка', new File(['x'], 'photo.heic', { type: 'image/heic' }));

    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG или WebP');
    expect(upload).not.toHaveBeenCalled();
  });

  it('заменить, переместить и удалить — без потери текста вокруг', async () => {
    const upload = vi.fn().mockResolvedValue(image(B, 'Новая.png'));
    const initial = `Один\nДва\n${embedToken('image', A)}\nТри`;
    const { value } = setup({ initial, upload, embeds: [image(A)] });

    fireEvent.click(screen.getByRole('button', { name: 'Переместить рисунок выше' }));
    expect(value.current).toBe(`Один\n${embedToken('image', A)}\nДва\nТри`);

    fireEvent.click(screen.getByRole('button', { name: 'Заменить' }));
    pickFile('Файл рисунка', png('new.png'));
    await waitFor(() => expect(value.current).toBe(`Один\n${embedToken('image', B)}\nДва\nТри`));

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(value.current).toBe('Один\nДва\nТри');
  });

  it('на краях текста перемещение неактивно', () => {
    setup({ initial: embedToken('image', A), embeds: [image(A)], upload: vi.fn() });
    expect(screen.getByRole('button', { name: 'Переместить рисунок выше' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Переместить рисунок ниже' })).toBeDisabled();
  });

  it('старый текст без правок не меняется, а в пустом месте между вставками можно писать', () => {
    const initial = `${embedToken('image', A)}\n${embedToken('image', C)}`;
    const { changes, value } = setup({ initial, embeds: [image(A), image(C)], upload: vi.fn() });
    expect(changes).toHaveLength(0);

    const slots = screen.getAllByPlaceholderText('Продолжите текст…');
    fireEvent.change(slots[1], { target: { value: 'между' } });

    expect(value.current).toBe(`${embedToken('image', A)}\nмежду\n${embedToken('image', C)}`);
  });

  it('картинка из буфера обмена вставляется рисунком', async () => {
    const upload = vi.fn().mockResolvedValue(image(A));
    const { value } = setup({ initial: 'Текст', upload });

    fireEvent.paste(screen.getByLabelText('Конспект'), { clipboardData: { files: [png('clip.png')] } });

    await waitFor(() => expect(value.current).toContain(embedToken('image', A)));
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'image');
  });

  it('без политики сервера кнопок вставки нет, а вставки показываются', () => {
    setup({ initial: `Текст\n${embedToken('image', A)}`, embeds: [image(A)], services: {} });

    expect(screen.queryByRole('button', { name: /Изображение/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Файл рисунка')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Схема.png' })).toBeInTheDocument();
  });
});
