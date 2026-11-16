import { useEffect, useState, type FocusEvent } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Library } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EntryCard } from '@/components/ui/EntryCard';
import { Select, TextInput } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { useClearLessonTextbook, useLessonTextbooks, useSelectLessonTextbook } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { openTextbookFile, textbookFileName } from '@/lib/textbookFile';
import { lessonTextbookLabel, parsePageRange } from '@/lib/textbookModel';
import { lessonTextbooksApi, type LessonTextbook, type LessonTextbooks } from '@/lib/textbooksApi';

const NOT_ASSIGNED_ANYMORE = 'Учебник больше не назначен классу — для этого урока он сохранён';

/**
 * Раздел «Учебник» в «Материалах урока» (Figma 2212:9448 / 2212:9521). До KSP-FE-001 это было
 * поле в блоке темы на карточке урока (2149:4182, 2149:4297, 2149:4415); карточка разрослась,
 * и учебник переехал к остальному, что видят ученики. Выбор учебника и страниц — тот же, что был
 * на карточке: раскрывается по «Выбрать учебник» / «Изменить».
 *
 * Кто может выбирать, говорит сервер (`canSelect`: учителя урока, не администратор), а
 * закрытый период замораживает выбор. Остальным раздел показывает выбор и открывает файл.
 *
 * Список запрашивается у каждого урока, а не по `LessonView.textbookCount`: счётчик считает
 * только то, что действует на дату урока, и выбор, назначение которого потом завершили,
 * он не видит — а раздел обязан его показать (контракт §6, `selected.active = false`).
 */
export function LessonTextbookSection({ lessonId, locked }: { lessonId: number; locked: boolean }) {
  const query = useLessonTextbooks(lessonId);
  const [editing, setEditing] = useState(false);
  const data = query.data;
  const selected = data?.selected ?? null;
  const canSelect = Boolean(data?.canSelect) && !locked;

  const description = query.isPending
    ? 'Загружаем учебники…'
    : query.isError
      ? (
        <span className="flex items-center gap-3">
          Не удалось загрузить учебники урока
          <button type="button" onClick={() => void query.refetch()}
            className="font-semibold text-navy-700 underline hover:text-navy-800">
            Повторить
          </button>
        </span>
      )
      : selected ? lessonTextbookLabel(selected) : 'Учебник к уроку не выбран';

  return (
    <EntryCard
      icon={<Library className="size-5" />}
      title="Учебник"
      meta="видят ученики в уроке"
      description={description}
      actions={data && (
        <>
          {canSelect && (selected
            ? <Button variant="ghost" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
              {editing ? 'Свернуть' : 'Изменить'}
            </Button>
            : <Button variant="secondary" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
              {editing ? 'Свернуть' : 'Выбрать учебник'}
            </Button>)}
          {selected && <OpenTextbookButton lessonId={lessonId} textbook={selected} />}
        </>
      )}
    >
      {data && canSelect && editing && <TextbookPicker lessonId={lessonId} data={data} />}
      {data && !editing && selected?.active === false && (
        <p className="text-xs text-slate-400">{NOT_ASSIGNED_ANYMORE}</p>
      )}
    </EntryCard>
  );
}

/**
 * Выбор учебника и страниц. Сохраняется сразу, без кнопки: поле живёт среди темы и
 * комментария, а не в форме. Страницы уходят, когда фокус покидает оба поля или по Enter —
 * иначе переход от «с» к «по» сохранял бы полдиапазона и писал в журнал лишнюю строку.
 */
function TextbookPicker({ lessonId, data }: { lessonId: number; data: LessonTextbooks }) {
  const toast = useToast();
  const select = useSelectLessonTextbook(lessonId);
  const clear = useClearLessonTextbook(lessonId);
  const selected = data.selected ?? null;
  const available = data.available ?? [];
  const busy = select.isPending || clear.isPending;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    setFrom(selected?.pageFrom != null ? String(selected.pageFrom) : '');
    setTo(selected?.pageTo != null ? String(selected.pageTo) : '');
    setPageError(null);
  }, [selected?.bindingId, selected?.pageFrom, selected?.pageTo]);

  if (available.length === 0 && !selected) {
    return (
      <p className="text-sm text-slate-400">
        На дату урока классу не назначено ни одного учебника.{' '}
        <Link to={ROUTES.textbooks} className="font-semibold text-navy-700 hover:text-navy-800">
          Назначить учебник
        </Link>
      </p>
    );
  }

  // Выбор с завершённым назначением в `available` не приходит, но значением поля остаётся.
  const options =
    selected && !available.some((item) => item.bindingId === selected.bindingId)
      ? [selected, ...available]
      : available;
  const pagesEditable = Boolean(selected?.pageNavigation) && selected?.active !== false;

  function report(error: unknown, fallback: string) {
    toast.error(error instanceof ApiError ? error.message : fallback);
  }

  function choose(value: string) {
    if (!value) {
      if (selected) clear.mutate(undefined, { onError: (error) => report(error, 'Не удалось снять выбор учебника') });
      return;
    }
    const bindingId = Number(value);
    if (bindingId === selected?.bindingId) return;
    // Страницы относятся к файлу: у другого учебника прежние номера ничего не значат.
    select.mutate({ bindingId }, { onError: (error) => report(error, 'Не удалось выбрать учебник') });
  }

  function savePages() {
    if (selected?.bindingId == null) return;
    const parsed = parsePageRange(from, to, selected.pageCount);
    if ('error' in parsed) {
      setPageError(parsed.error);
      return;
    }
    setPageError(null);
    const { pageFrom, pageTo } = parsed.range;
    if ((selected.pageFrom ?? null) === pageFrom && (selected.pageTo ?? null) === pageTo) return;
    select.mutate(
      { bindingId: selected.bindingId, pageFrom: pageFrom ?? undefined, pageTo: pageTo ?? undefined },
      { onError: (error) => report(error, 'Не удалось сохранить страницы') },
    );
  }

  function onPagesBlur(event: FocusEvent<HTMLSpanElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) savePages();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Учебник"
          value={selected?.bindingId != null ? String(selected.bindingId) : ''}
          disabled={busy}
          onChange={(event) => choose(event.target.value)}
          className="h-9 w-auto min-w-56 rounded-lg py-0"
        >
          <option value="">{selected ? 'Снять выбор' : 'Выберите учебник'}</option>
          {options.map((item) => (
            <option key={item.bindingId} value={String(item.bindingId)}>
              {item.title}
            </option>
          ))}
        </Select>

        {pagesEditable && (
          <span className="flex items-center gap-3" onBlur={onPagesBlur}>
            <span className="text-13 text-slate-500">Страница</span>
            <TextInput
              aria-label="С какой страницы"
              inputMode="numeric"
              value={from}
              disabled={busy}
              error={pageError != null}
              onChange={(event) => setFrom(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && savePages()}
              className="h-9 w-16 rounded-lg px-2 py-0 text-center"
            />
            <span className="text-13 text-slate-500">по</span>
            <TextInput
              aria-label="По какую страницу"
              inputMode="numeric"
              value={to}
              disabled={busy}
              error={pageError != null}
              onChange={(event) => setTo(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && savePages()}
              className="h-9 w-16 rounded-lg px-2 py-0 text-center"
            />
          </span>
        )}

      </div>

      {pageError && <p className="text-xs text-red-500">{pageError}</p>}
      {selected?.active === false && <p className="text-xs text-slate-400">{NOT_ASSIGNED_ANYMORE}</p>}
      {!selected && (
        <p className="text-xs text-slate-400">
          Ученики всё равно смогут открыть учебники, назначенные классу — просто без указания конкретной
          страницы для этого урока.
        </p>
      )}
    </div>
  );
}

/** Файл через урок: PDF открывается сразу на первой странице диапазона, DOCX скачивается. */
function OpenTextbookButton({ lessonId, textbook }: { lessonId: number; textbook: LessonTextbook }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  async function open() {
    if (textbook.textbookId == null) return;
    setOpening(true);
    try {
      await openTextbookFile({
        load: () => lessonTextbooksApi.content(lessonId, textbook.textbookId as number),
        format: textbook.format,
        fileName: textbook.fileName ?? textbookFileName(textbook.title, textbook.format),
        page: textbook.pageNavigation ? textbook.pageFrom : null,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось открыть учебник');
    } finally {
      setOpening(false);
    }
  }

  return (
    <Button variant="secondary" loading={opening} onClick={() => void open()}
      icon={<ExternalLink className="size-4" aria-hidden />}>
      {textbook.format === 'DOCX' ? 'Скачать' : 'Открыть'}
    </Button>
  );
}
