import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MathText } from '@/components/ui/MathText';
import { useToast } from '@/context/ToastContext';
import { useCorrectAiRecognition } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { AttachmentGallery } from './AttachmentLink';

type Page = Schema<'RecognizedPage'>;

const TEXT_LIMIT = 10_000;

/**
 * Что ИИ прочитал на каждом фото работы — дословно, рядом с оригиналом (QA B2-021…B2-024).
 *
 * <p>Это не выводы модели, а расшифровка: её выводы — комментарий, ошибки и решение — стоят
 * в карточке отдельно. Неразборчивое модель помечает `[?]` и перечисляет; дочитывает учитель —
 * его правка сохраняется рядом с текстом модели, а не вместо него, и ничего не блокирует:
 * оценку и проверку можно закончить и без неё.
 */
export function RecognitionPages({
  homeworkId,
  studentProfileId,
  pages,
  loadAttachment,
  editedByName,
}: {
  homeworkId: number;
  studentProfileId: number;
  pages: Page[];
  loadAttachment?: (id: number) => Promise<Blob>;
  editedByName?: string;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label="Распознанное с фото">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-11 font-semibold uppercase tracking-wide text-subtle">Распознано с фото</p>
        {editedByName && <p className="text-11 text-muted">Правки: {editedByName}</p>}
      </div>
      {pages.map((page) => (
        <RecognitionPage
          key={page.photo}
          homeworkId={homeworkId}
          studentProfileId={studentProfileId}
          page={page}
          loadAttachment={loadAttachment}
        />
      ))}
    </section>
  );
}

function RecognitionPage({
  homeworkId,
  studentProfileId,
  page,
  loadAttachment,
}: {
  homeworkId: number;
  studentProfileId: number;
  page: Page;
  loadAttachment?: (id: number) => Promise<Blob>;
}) {
  const toast = useToast();
  const correct = useCorrectAiRecognition(homeworkId, studentProfileId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const unclear = page.unclear ?? [];
  const corrected = page.correctedText ?? null;

  function save(text: string) {
    correct.mutate([{ photo: page.photo ?? 0, text }], {
      onSuccess: () => setEditing(false),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить правку'),
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-white p-3 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col gap-1">
        <span className="text-11 font-semibold text-subtle">Фото {page.photo}</span>
        {page.attachmentId != null && loadAttachment && (
          <AttachmentGallery attachments={[{ id: page.attachmentId }]} load={loadAttachment} />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <p className="text-11 text-muted">Как прочитал ИИ</p>
          <MathText text={page.text ?? ''} className="mt-0.5 block whitespace-pre-wrap text-13 text-ink" />
        </div>

        {unclear.length > 0 && (
          <div className="rounded-md bg-attention-bg px-2.5 py-1.5 text-13 text-attention-fg">
            <p className="font-semibold">Не прочитано — проверьте на фото:</p>
            <ul className="list-inside list-disc">
              {unclear.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-2">
            <label className="label-base" htmlFor={`recognition-${page.photo}`}>
              Текст с фото {page.photo} — исправленный
            </label>
            <textarea
              id={`recognition-${page.photo}`}
              value={draft}
              maxLength={TEXT_LIMIT}
              rows={5}
              onChange={(event) => setDraft(event.target.value)}
              className="input-base resize-y font-mono text-13"
            />
            <p className="text-11 text-subtle">Формулы — в долларах: $v = \frac{'{s}{t}'}$.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={correct.isPending} onClick={() => save(draft)}>
                Сохранить правку
              </Button>
              <Button size="sm" variant="secondary" disabled={correct.isPending} onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : corrected ? (
          <div className="rounded-md border border-line bg-neutral-bg px-2.5 py-1.5">
            <p className="text-11 text-muted">Исправлено учителем</p>
            <MathText text={corrected} className="mt-0.5 block whitespace-pre-wrap text-13 text-ink" />
            <div className="mt-1.5 flex flex-wrap gap-3">
              <Button variant="ghost" size="text" onClick={() => { setDraft(corrected); setEditing(true); }}>
                Изменить
              </Button>
              <Button variant="ghost" size="text" disabled={correct.isPending} onClick={() => save('')}>
                Вернуть текст ИИ
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="text"
            className="self-start"
            icon={<Pencil className="size-3.5" aria-hidden />}
            onClick={() => { setDraft(page.text ?? ''); setEditing(true); }}
          >
            Исправить распознанное
          </Button>
        )}
      </div>
    </div>
  );
}
