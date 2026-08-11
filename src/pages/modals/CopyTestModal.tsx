import { useEffect, useState, type FormEvent } from 'react';
import { Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useCopyTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import type { Test } from '@/lib/types';

/**
 * Копия AI-теста во вступительные.
 *
 * <p>Именно копия, а не перенос: AI-тест остаётся банком вопросов — из него можно нарезать
 * несколько вступительных, а генерацию запустить ещё раз. Копия создаётся черновиком, без
 * назначений и с версией 1.
 *
 * <p>Черновики по умолчанию не берём: во вступительном тесте нет UI ревью черновиков
 * (он включён только для AI-тестов), и непроверенный вопрос стал бы невидимым.
 */
export function CopyTestModal({
  open,
  onClose,
  test,
  onCopied,
}: {
  open: boolean;
  onClose: () => void;
  test: Test | null;
  onCopied: (copy: Test) => void;
}) {
  const copy = useCopyTest();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftCount = test?.draftQuestionCount ?? 0;
  const publishedCount = test?.questionCount ?? 0;
  const copiedCount = includeDrafts ? publishedCount + draftCount : publishedCount;

  useEffect(() => {
    if (!open || !test) return;
    setTitle(`${test.title} (копия)`);
    setIncludeDrafts(false);
    setError(null);
  }, [open, test]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!test) return;
    if (!title.trim()) {
      setError('Укажите название копии');
      return;
    }
    setError(null);
    try {
      const created = await copy.mutateAsync({
        id: test.id,
        body: { title: title.trim(), includeDrafts },
      });
      toast.success('Копия создана во вступительных тестах');
      onCopied(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось скопировать тест');
    }
  }

  return (
    <Modal
      open={open}
      onClose={copy.isPending ? () => {} : onClose}
      title="Скопировать во вступительные тесты"
      subtitle={test ? `Источник — «${test.title}»` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={copy.isPending}>
            Отмена
          </Button>
          <Button
            form="copy-test-form"
            type="submit"
            icon={<Copy className="h-4 w-4" />}
            loading={copy.isPending}
            disabled={copy.isPending || copiedCount === 0}
          >
            Скопировать
          </Button>
        </>
      }
    >
      <form id="copy-test-form" onSubmit={submit} className="space-y-4">
        <Field label="Название копии" required>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            autoFocus
          />
        </Field>

        {draftCount > 0 && (
          <Toggle
            checked={includeDrafts}
            onChange={setIncludeDrafts}
            label={`Взять и черновики (${draftCount})`}
            description="Непроверенные вопросы AI попадут в копию как обычные — во вступительном тесте ревью черновиков нет."
          />
        )}

        <p className="text-sm text-slate-500">
          {copiedCount > 0 ? (
            <>
              В копию попадёт{' '}
              <b>
                {copiedCount} {pluralRu(copiedCount, ['вопрос', 'вопроса', 'вопросов'])}
              </b>
              . Копия создаётся черновиком, без назначений; настройки и класс — как у оригинала.
            </>
          ) : (
            <>
              Копировать нечего: в тесте нет проверенных вопросов. Опубликуйте черновики
              {draftCount > 0 ? ' или включите их в копию' : ''}.
            </>
          )}
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
