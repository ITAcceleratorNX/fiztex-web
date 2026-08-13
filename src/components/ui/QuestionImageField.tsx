import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { ApiError } from '@/lib/api';
import { useDeleteQuestionImage, useUploadQuestionImage } from '@/hooks/queries';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic';

/**
 * Рисунок к вопросу: схема, график, чертёж — то, без чего задание не решается.
 *
 * <p>Загрузка идёт своим эндпоинтом, а не полем в теле теста, поэтому вопрос должен быть уже
 * сохранён: у несохранённого нет id, к которому прикреплять файл. Это видно в интерфейсе, а не
 * выясняется ошибкой сервера.
 *
 * <p>Импорт и AI-генерация переносят рисунок только словами — пометкой «[Рисунок: …]» в тексте
 * (пиксели из PDF не извлекаются), поэтому настоящую картинку учитель прикладывает здесь,
 * поверх готового черновика.
 */
export function QuestionImageField({
  testId,
  questionId,
  imageUrl,
}: {
  testId: number;
  questionId: number | null;
  imageUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadQuestionImage(testId);
  const remove = useDeleteQuestionImage(testId);
  const busy = upload.isPending || remove.isPending;

  async function onPick(file: File | undefined) {
    setError(null);
    if (!file || questionId == null) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Файл больше 10 МБ');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      await upload.mutateAsync({ questionId, formData });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить рисунок');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="mt-4">
      <p className="label-base">Рисунок к вопросу</p>

      {imageUrl ? (
        <div className="flex flex-wrap items-start gap-3">
          <img
            src={imageUrl}
            alt="Рисунок к вопросу"
            className="max-h-40 rounded-xl border border-slate-200 bg-white object-contain"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Заменить
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => {
                setError(null);
                if (questionId != null) void remove.mutateAsync(questionId).catch(() => {
                  setError('Не удалось удалить рисунок');
                });
              }}
            >
              Удалить
            </Button>
          </div>
        </div>
      ) : questionId == null ? (
        <p className="text-13 text-slate-400">
          Сохраните вопрос, чтобы прикрепить к нему рисунок.
        </p>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<ImagePlus className="h-3.5 w-3.5" />}
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Прикрепить рисунок
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
