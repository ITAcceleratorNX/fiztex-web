import { useState } from 'react';
import { Copy, Maximize2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Markdown } from '@/components/ui/Markdown';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useLessonAiNotes, useLessonTextbooks, useStartLessonAiNote } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { LessonMaterial } from '@/lib/homeworkAiApi';
import { isNoteActive, type LessonAiNoteKind } from '@/lib/lessonAiNotesApi';
import { lessonTextbookLabel } from '@/lib/textbookModel';
import { LessonAiNoteReader } from './LessonAiNoteReader';

const KIND_TABS = [
  { value: 'SUMMARY', label: 'Конспект' },
  { value: 'PLAN', label: 'План урока' },
] as const satisfies ReadonlyArray<{ value: LessonAiNoteKind; label: string }>;

const GENERATE_LABEL: Record<LessonAiNoteKind, string> = {
  SUMMARY: 'Сгенерировать конспект',
  PLAN: 'Сгенерировать план',
};

const EMPTY_HINT: Record<LessonAiNoteKind, string> = {
  SUMMARY: 'Главное, понятия, формулы и выводы — чтобы вспомнить материал за пару минут.',
  PLAN: 'Этапы урока с минутами и короткий рассказ к каждому: что говорить классу.',
};

/**
 * AI-шпаргалка к уроку (LESSON-AI-001): учитель выбирает материалы урока и/или учебник,
 * пишет тему — и получает краткий конспект или план урока.
 *
 * Живёт на странице материалов, а не отдельным экраном: файлы загружаются там же, и
 * загрузить → выбрать → получить — один экран без переходов. Своих файлов блок не заводит:
 * источники — это уже приложенные материалы и учебник, выбранный в карточке урока.
 *
 * Два вида — два окна одного блока: конспект и план генерируются и живут независимо,
 * перегенерация одного не трогает другой.
 */
export function LessonAiNotesCard({
  lessonId,
  topic,
  subtitle,
  materials,
}: {
  lessonId: number;
  topic: string | undefined;
  /** Предмет, класс и тема — шапка полноэкранного чтения, где страницы урока уже не видно. */
  subtitle?: string;
  materials: LessonMaterial[];
}) {
  const toast = useToast();
  const notesQuery = useLessonAiNotes(lessonId);
  const textbooksQuery = useLessonTextbooks(lessonId);
  const start = useStartLessonAiNote(lessonId);

  const [kind, setKind] = useState<LessonAiNoteKind>('SUMMARY');
  const [prompt, setPrompt] = useState('');
  // Храним снятые галочки, а не поставленные: только что загруженный файл выбран сразу.
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [useTextbook, setUseTextbook] = useState(true);
  const [reading, setReading] = useState(false);

  // Ссылки модель не читает — предлагать их в источники значило бы обещать то, чего не будет.
  const files = materials.filter((material) => material.kind !== 'LINK' && material.id != null);
  const selectedIds = files.map((file) => file.id as number).filter((id) => !excluded.has(id));

  const textbook = textbooksQuery.data?.selected;
  const textbookProblem = !textbook
    ? null
    : textbook.format !== 'PDF'
      ? 'у DOCX нет страниц — приложите нужный фрагмент файлом'
      : textbook.pageFrom == null
        ? 'укажите страницы в карточке урока'
        : null;
  const textbookUsable = textbook != null && textbookProblem == null;
  const withTextbook = textbookUsable && useTextbook;

  const note = notesQuery.data?.find((row) => row.kind === kind);
  const running = isNoteActive(note);
  const hasSource = selectedIds.length > 0 || withTextbook || prompt.trim() !== '' || !!topic?.trim();

  function toggle(id: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onGenerate() {
    try {
      await start.mutateAsync({
        kind,
        materialIds: selectedIds,
        useTextbook: withTextbook,
        teacherPrompt: prompt.trim() || undefined,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось запустить генерацию');
    }
  }

  async function onCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать');
    }
  }

  return (
    <section className="card flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-bg">
          <Sparkles className="size-4 text-navy-700" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-15 font-bold text-ink">AI-шпаргалка к уроку</h2>
          <p className="text-13 text-muted">
            Краткий конспект и план урока по материалам, учебнику и теме. Видна только учителю.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-13 font-medium text-ink">Из чего составить</p>
        {files.length === 0 && !textbook ? (
          <p className="text-13 text-muted">
            Материалов пока нет — загрузите файл выше или просто напишите тему ниже.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {files.map((file) => (
              <li key={file.id}>
                <label className="flex items-center gap-2 text-13 text-ink">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-line"
                    checked={!excluded.has(file.id as number)}
                    onChange={() => toggle(file.id as number)}
                  />
                  <span className="truncate">{file.fileName ?? 'Файл'}</span>
                </label>
              </li>
            ))}
            {textbook && (
              <li>
                <label className="flex items-center gap-2 text-13 text-ink">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-line"
                    checked={withTextbook}
                    disabled={!textbookUsable}
                    onChange={(event) => setUseTextbook(event.target.checked)}
                  />
                  <span className="truncate">Учебник: {lessonTextbookLabel(textbook)}</span>
                  {textbookProblem && (
                    <span className="shrink-0 text-11 text-subtle">— {textbookProblem}</span>
                  )}
                </label>
              </li>
            )}
          </ul>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-13 font-medium text-ink">Тема или пожелание</span>
        <TextArea
          rows={2}
          maxLength={2000}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Например: второй закон Ньютона, больше примеров из жизни"
        />
        {topic?.trim() && (
          <span className="text-11 text-subtle">Тема урока «{topic.trim()}» учитывается сама.</span>
        )}
      </label>

      <div className="flex flex-col gap-4 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs value={kind} options={KIND_TABS} onChange={setKind} ariaLabel="Вид шпаргалки" />
          <Button
            onClick={() => void onGenerate()}
            disabled={running || start.isPending || !hasSource}
            loading={start.isPending}
          >
            <Sparkles className="size-4" aria-hidden />
            {note?.status === 'DONE' ? 'Сгенерировать заново' : GENERATE_LABEL[kind]}
          </Button>
        </div>

        {notesQuery.isPending ? (
          <LoadingBlock label="Загрузка…" />
        ) : notesQuery.isError ? (
          <ErrorBlock message="Не удалось загрузить шпаргалку" onRetry={() => void notesQuery.refetch()} />
        ) : !note ? (
          <p className="text-13 text-muted">{EMPTY_HINT[kind]}</p>
        ) : note.status === 'DONE' ? (
          <div className="flex flex-col gap-3">
            {note.warningMessage && <NoticeBar tone="warning">{note.warningMessage}</NoticeBar>}
            <Markdown source={note.text} math />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setReading(true)}>
                <Maximize2 className="size-4" aria-hidden />
                На весь экран
              </Button>
              <Button variant="secondary" onClick={() => void onCopy(note.text ?? '')}>
                <Copy className="size-4" aria-hidden />
                Копировать
              </Button>
            </div>
            {reading && (
              <LessonAiNoteReader
                title={KIND_TABS.find((tab) => tab.value === kind)?.label ?? 'Шпаргалка'}
                subtitle={subtitle}
                text={note.text ?? ''}
                onCopy={() => void onCopy(note.text ?? '')}
                onClose={() => setReading(false)}
              />
            )}
          </div>
        ) : (
          <AiJobProgress job={note} />
        )}
      </div>
    </section>
  );
}
