import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useLessonMaterials, useLessonTextbooks, useSummaryCommands, useSummaryLibrary,
  useSummarySource, useUploadSummarySource,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Lesson } from '@/lib/lessonsApi';
import type { SummaryContent, SummaryGeneration } from '@/lib/lessonSummaryApi';

const supported = /\.(pdf|docx|txt|png|jpe?g)$/i;
const sourceTabs = [
  { value: 'TEXTBOOK', label: 'Учебник' },
  { value: 'MATERIAL', label: 'Материал урока' },
  { value: 'UPLOAD', label: 'Загрузить файл' },
] as const;

export function LessonSummaryGenerateModal({ lesson, companionKind, onClose, onStarted }: {
  lesson: Lesson;
  companionKind: SummaryContent['companionKind'];
  onClose: () => void;
  onStarted?: () => void;
}) {
  const id = lesson.id!;
  const [tab, setTab] = useState<'TEXTBOOK' | 'MATERIAL' | 'UPLOAD'>('TEXTBOOK');
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [chosenTitle, setChosenTitle] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prompt, setPrompt] = useState(lesson.topic ?? '');
  const [kind, setKind] = useState(companionKind);
  const [language, setLanguage] = useState('ru');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const attempt = useRef<{ body: string; key: string }>();
  const textbooks = useLessonTextbooks(id);
  const materials = useLessonMaterials(id);
  const library = useSummaryLibrary(tab === 'TEXTBOOK' ? lesson.subjectId : undefined, search);
  const type = tab === 'TEXTBOOK' ? 'TEXTBOOK' : 'LESSON_MATERIAL';
  const metadata = useSummarySource(id, type, sourceId);
  const upload = useUploadSummarySource(id);
  const { start } = useSummaryCommands(id);
  const busy = start.isPending || upload.isPending;

  useEffect(() => {
    if (initialized.current || !textbooks.data) return;
    initialized.current = true;
    const selected = textbooks.data.selected;
    if (selected?.textbookId) {
      setSourceId(selected.textbookId);
      setChosenTitle(selected.title ?? 'Учебник урока');
      setFrom(selected.pageFrom ? String(selected.pageFrom) : '');
      setTo(selected.pageTo ? String(selected.pageTo) : '');
    }
  }, [textbooks.data]);

  const bookOptions = new Map<number, string>();
  if (textbooks.data?.selected?.textbookId) {
    const selected = textbooks.data.selected;
    bookOptions.set(selected.textbookId!, (selected.title ?? 'Учебник') + ' · выбран в уроке');
  }
  for (const book of textbooks.data?.available ?? []) {
    if (book.textbookId && !bookOptions.has(book.textbookId)) bookOptions.set(book.textbookId, (book.title ?? 'Учебник') + ' · для класса');
  }
  for (const book of library.data?.pages.flatMap((page) => page.content ?? []) ?? []) {
    if (book.id && !bookOptions.has(book.id)) bookOptions.set(book.id, book.title ?? book.fileName ?? 'Учебник');
  }
  if (tab === 'TEXTBOOK' && sourceId && !bookOptions.has(sourceId)) bookOptions.set(sourceId, chosenTitle);
  const materialOptions = (materials.data ?? []).filter((material) => material.kind !== 'LINK' && supported.test(material.fileName ?? ''));
  const source = metadata.data;
  const pageError = source?.pageNavigation ? validatePages(from, to, source.pageCount ?? 0, source.maxPages ?? 30) : '';

  function changeTab(next: typeof tab) {
    initialized.current = true;
    setTab(next);
    setSourceId(null);
    setFrom('');
    setTo('');
    setError('');
    setFile(null);
  }

  function choose(value: string) {
    initialized.current = true;
    const next = value ? Number(value) : null;
    setSourceId(next);
    setChosenTitle(next ? bookOptions.get(next) ?? '' : '');
    const selected = textbooks.data?.selected;
    setFrom(tab === 'TEXTBOOK' && next === selected?.textbookId && selected.pageFrom ? String(selected.pageFrom) : '');
    setTo(tab === 'TEXTBOOK' && next === selected?.textbookId && selected.pageTo ? String(selected.pageTo) : '');
    setError('');
  }

  async function pickFile(next: File | null) {
    setError('');
    setSourceId(null);
    setFrom('');
    setTo('');
    setFile(next);
    if (!next) return;
    if (!supported.test(next.name) || next.size > 50 * 1024 * 1024 || next.size === 0) {
      setError('Выберите PDF, DOCX, TXT, PNG или JPG размером до 50 МБ. Файл не должен быть пустым.');
      return;
    }
    try {
      const material = await upload.mutateAsync(next);
      setSourceId(material.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить файл. Повторите загрузку.');
    }
  }

  async function generate() {
    if (!sourceId || !source || pageError || busy) return;
    const body: SummaryGeneration = {
      sourceType: type, sourceId, companionKind: kind, teacherPrompt: prompt.trim(), language,
      ...(source.pageNavigation && from ? { pageFrom: Number(from), pageTo: Number(to || from) } : {}),
    };
    const serialized = JSON.stringify(body);
    if (attempt.current?.body !== serialized) attempt.current = { body: serialized, key: crypto.randomUUID() };
    setError('');
    try {
      await start.mutateAsync({ body, key: attempt.current.key });
      onStarted?.();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось начать генерацию. Повторите попытку.');
    }
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} size="lg" title="Создать конспект с ИИ"
      subtitle="Выберите источник и укажите, какую тему разобрать."
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={onClose}>Отмена</Button>
        <Button icon={<Sparkles className="size-4" />} loading={start.isPending}
          disabled={busy || !source || metadata.isError || Boolean(pageError)} onClick={() => void generate()}>
          Сгенерировать
        </Button>
      </>}>
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <SegmentedTabs value={tab} options={sourceTabs} onChange={changeTab} ariaLabel="Источник конспекта" className="flex-wrap" />
        {tab === 'TEXTBOOK' && <>
          <TextInput aria-label="Поиск в моей библиотеке" placeholder="Поиск в моей библиотеке" value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <Field label="Учебник" required hint="Учебники урока и ваша библиотека по этому предмету">
            <Select aria-label="Учебник" value={sourceId ?? ''} onChange={(e) => choose(e.target.value)}>
              <option value="">Выберите учебник</option>
              {[...bookOptions].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {(textbooks.isPending || library.isPending) && <LoadingBlock label="Загружаем учебники…" />}
          {textbooks.isError && <ErrorBlock message="Не удалось загрузить учебники урока" onRetry={() => void textbooks.refetch()} />}
          {library.isError && <ErrorBlock message="Не удалось загрузить библиотеку" onRetry={() => void library.refetch()} />}
          {library.hasNextPage && <Button size="sm" variant="ghost" loading={library.isFetchingNextPage}
            onClick={() => void library.fetchNextPage()}>Загрузить ещё учебники</Button>}
          {!textbooks.isPending && !library.isPending && bookOptions.size === 0 && <p className="text-sm text-muted">
            Учебники не найдены. Выберите материал урока или загрузите файл.
          </p>}
        </>}
        {tab === 'MATERIAL' && <>
          <Field label="Материал урока" required>
            <Select aria-label="Материал урока" value={sourceId ?? ''} onChange={(e) => choose(e.target.value)}>
              <option value="">Выберите материал</option>
              {materialOptions.map((material) => <option key={material.id} value={material.id}>{material.fileName}</option>)}
            </Select>
          </Field>
          {materials.isPending && <LoadingBlock label="Загружаем материалы…" />}
          {materials.isError && <ErrorBlock message="Не удалось загрузить материалы" onRetry={() => void materials.refetch()} />}
          {!materials.isPending && !materials.isError && materialOptions.length === 0 && <p className="text-sm text-muted">
            Подходящих файлов пока нет. Загрузите PDF, DOCX, TXT или фотографию.
          </p>}
        </>}
        {tab === 'UPLOAD' && <>
          <FileDropzone file={file} onChange={(next) => void pickFile(next)} disabled={busy}
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" formatsLabel="PDF, DOCX, TXT, PNG, JPG · до 50 МБ" error={Boolean(error)} />
          <p className="text-sm text-muted">Файл сохранится в материалах урока с пометкой «Только для учителя».</p>
          {upload.isPending && <LoadingBlock label="Загружаем файл…" />}
          {upload.isError && file && <Button variant="secondary" onClick={() => void pickFile(file)}>Повторить загрузку</Button>}
        </>}
        {sourceId && metadata.isPending && <LoadingBlock label="Проверяем материал…" />}
        {metadata.isError && <ErrorBlock message={metadata.error.message} onRetry={() => void metadata.refetch()} />}
        {source?.pageNavigation && <Field label="Страницы PDF" error={pageError}
          hint={'Всего ' + source.pageCount + ' стр. За один раз — до ' + source.maxPages + '. Номера страниц в файле могут отличаться от печатных.'}>
          <div className="flex items-center gap-3">
            <TextInput type="number" min={1} max={source.pageCount} aria-label="Со страницы" placeholder="С" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted">—</span>
            <TextInput type="number" min={1} max={source.pageCount} aria-label="По страницу" placeholder="По" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </Field>}
        <Field label="Тема или пожелание" hint="Например: объясни второй закон Ньютона простыми словами, выдели определения и формулы.">
          <TextArea aria-label="Тема или пожелание" rows={3} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Второй блок">
            <Select aria-label="Второй блок" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="RETELLING">Краткий пересказ</option>
              <option value="PLAN">План урока</option>
            </Select>
          </Field>
          <Field label="Язык конспекта">
            <Select aria-label="Язык конспекта" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
            </Select>
          </Field>
        </div>
        <NoticeBar tone="soft">ИИ сохранит результат как черновик. Проверьте его перед публикацией: ученики увидят оба блока.</NoticeBar>
        {error && <div role="alert" className="text-sm text-danger-fg">{error}</div>}
      </fieldset>
    </Modal>
  );
}

export function validatePages(from: string, to: string, total: number, limit: number): string {
  if (!from && !to) return total > limit ? 'Укажите нужные страницы: за один раз можно обработать до ' + limit + '.' : '';
  const first = Number(from);
  const last = Number(to || from);
  if (!from || !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > total) {
    return 'Укажите страницы от 1 до ' + total + ', в порядке возрастания.';
  }
  return last - first + 1 > limit ? 'Выберите не больше ' + limit + ' страниц.' : '';
}
