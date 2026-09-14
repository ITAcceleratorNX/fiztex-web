/**
 * Открыть файл учебника, отданный под авторизацией.
 *
 * Эндпоинты `/content` отвечают потоком только с заголовком `Authorization`, поэтому обычная
 * ссылка на них не работает — файл забирается запросом и живёт как object URL.
 *
 * * **PDF** — новой вкладкой, сразу на нужной странице: фрагмент `#page=N` понимают
 *   встроенные просмотрщики Chrome, Firefox и Safari.
 * * **DOCX** браузер не отрисует, и сервер сам просит его скачать
 *   (`Content-Disposition: attachment`, контракт §5) — сохраняем файлом под понятным именем.
 */
export async function openTextbookFile({
  load,
  format,
  fileName,
  page,
}: {
  load: () => Promise<Blob>;
  format: string | null | undefined;
  fileName: string;
  page?: number | null;
}): Promise<void> {
  if (format === 'DOCX') {
    const url = URL.createObjectURL(await load());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Вкладка открывается до запроса: учебник качается секундами, и `window.open` после
  // `await` браузер уже не свяжет с нажатием — заблокирует как всплывающее окно.
  const tab = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await load());
    const target = page ? `${url}#page=${page}` : url;
    if (tab) {
      tab.opener = null;
      tab.location.href = target;
    } else {
      window.open(target, '_blank', 'noopener');
    }
    // Просмотрщику нужно время дочитать большой файл — ссылку держим с запасом.
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export function textbookFileName(title: string | null | undefined, format: string | null | undefined): string {
  const extension = format === 'DOCX' ? 'docx' : 'pdf';
  return `${(title ?? 'Учебник').trim() || 'Учебник'}.${extension}`;
}
