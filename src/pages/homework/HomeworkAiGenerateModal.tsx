import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { AiJobProgress } from '@/components/ui/AiJobProgress';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { EmptyBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useApplyHomeworkAiResult,
  useHomeworkAiJob,
  useHomeworkAiQuota,
  useLessonMaterials,
  useStartHomeworkAiGeneration,
} from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';

export type GenerateKind = 'MATERIAL' | 'TEST';

/**
 * Генерация содержимого задания моделью (ТЗ HOMEWORK-BE-006 §5, §6).
 *
 * <p><b>Окно не держит задачу.</b> Она живёт строкой в базе, поэтому закрыть его можно
 * в любой момент: учитель уходит на урок, возвращается — результат уже в задании.
 * Модальность здесь про фокус, а не про то, что процесс нельзя оставить.
 *
 * <p><b>Ключ идемпотентности генерируется один раз на открытие.</b> Повторное нажатие
 * «Сгенерировать» на плохой сети не должно стать вторым платным вызовом модели.
 *
 * <p><b>Если учитель правил задание,</b> результат не заменит его работу сам: бэкенд
 * вернёт задачу с `awaitingDecision`, и выбор — заменить или оставить — делает человек.
 */
export function HomeworkAiGenerateModal({
  open,
  onClose,
  homeworkId,
  lessonId,
  kind,
  onWriteManually,
}: {
  open: boolean;
  onClose: () => void;
  homeworkId: number;
  lessonId: number | null;
  kind: GenerateKind;
  /** «Написать самому» — всегда доступный выход, если модель не справилась. */
  onWriteManually: () => void;
}) {
  const toast = useToast();
  const quotaQuery = useHomeworkAiQuota(open);
  const materialsQuery = useLessonMaterials(open ? lessonId : null);
  const start = useStartHomeworkAiGeneration(homeworkId);
  const apply = useApplyHomeworkAiResult(homeworkId);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [openQuestionCount, setOpenQuestionCount] = useState(2);
  const [jobId, setJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string>('');
  const handledJob = useRef<number | null>(null);

  const { data: job } = useHomeworkAiJob(open ? jobId : null);
  const materials = useMemo(() => materialsQuery.data ?? [], [materialsQuery.data]);
  const quota = quotaQuery.data;
  const running = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const exhausted = (quota?.remaining ?? 1) <= 0;

  // Материалы урока предлагаются все: учитель приложил их именно затем, чтобы по ним
  // и генерировали, а снятие галочки — исключение, а не норма.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(materials.map((m) => m.id).filter((id): id is number => id != null)));
  }, [open, materials]);

  useEffect(() => {
    if (!open) return;
    setTeacherPrompt('');
    setQuestionCount(10);
    setOpenQuestionCount(2);
    setJobId(null);
    setError(null);
    handledJob.current = null;
    idempotencyKey.current = crypto.randomUUID();
  }, [open, kind]);

  // Готовую задачу разбираем один раз: опрос продолжает возвращать её же.
  useEffect(() => {
    if (!job || job.id == null || handledJob.current === job.id) return;
    if (job.status !== 'DONE') return;
    handledJob.current = job.id;
    if (job.applied) {
      toast.success(job.warningMessage ? `Готово. ${job.warningMessage}` : 'Готово');
      onClose();
    }
  }, [job, toast, onClose]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await start.mutateAsync({
        key: idempotencyKey.current,
        input: {
          kind,
          materialIds: [...selected],
          teacherPrompt: teacherPrompt.trim() || undefined,
          ...(kind === 'TEST' ? { questionCount, openQuestionCount } : {}),
        },
      });
      setJobId(created.id ?? null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось запустить генерацию');
    }
  }

  async function onApply() {
    if (jobId == null) return;
    try {
      await apply.mutateAsync(jobId);
      toast.success('Новый вариант в задании');
      onClose();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось применить результат');
    }
  }

  const title = kind === 'TEST' ? 'Сгенерировать тест' : 'Сгенерировать конспект';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="По материалам урока. Результат — черновик: перечитайте его перед публикацией."
      size="lg"
    >
      {job?.awaitingDecision ? (
        <AwaitingDecision
          busy={apply.isPending}
          onApply={() => void onApply()}
          onKeep={onClose}
        />
      ) : jobId != null ? (
        <div className="flex flex-col gap-4">
          <AiJobProgress
            job={job}
            fallbackAction={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  onWriteManually();
                }}
              >
                Написать самому
              </Button>
            }
          />
          {!running && (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          {lessonId == null && (
            <NoticeBar tone="soft">
              Задание создано вне урока — генерация работает только для заданий из урока:
              тема и материалы берутся из него.
            </NoticeBar>
          )}

          <MaterialPicker
            loading={materialsQuery.isPending}
            materials={materials}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />

          <Field label="Что нужно получить" hint="Необязательно">
            <TextArea
              value={teacherPrompt}
              onChange={(event) => setTeacherPrompt(event.target.value)}
              maxLength={2000}
              placeholder={
                kind === 'TEST'
                  ? 'например: побольше задач на расчёт, без теории'
                  : 'например: коротко, с формулой плотности и одним примером'
              }
            />
          </Field>

          {kind === 'TEST' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Всего вопросов">
                <TextInput
                  type="number"
                  min={1}
                  max={30}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                />
              </Field>
              <Field label="Из них открытых" hint="Их проверяет учитель">
                <TextInput
                  type="number"
                  min={0}
                  max={questionCount}
                  value={openQuestionCount}
                  onChange={(event) => setOpenQuestionCount(Number(event.target.value))}
                />
              </Field>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Остаток показываем всегда: внезапный отказ по лимиту хуже заметного счётчика. */}
            <span className="text-11 text-subtle">
              {quota
                ? `Осталось ${quota.remaining} ${pluralRu(quota.remaining ?? 0, [
                    'генерация',
                    'генерации',
                    'генераций',
                  ])} из ${quota.dailyQuota} на сегодня`
                : ''}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" loading={start.isPending} disabled={exhausted || lessonId == null}>
                <Sparkles className="size-4" aria-hidden />
                Сгенерировать
              </Button>
            </div>
          </div>

          {exhausted && (
            <NoticeBar tone="soft">
              Лимит генераций на сегодня исчерпан. Задание можно написать самому — это
              всегда доступно.
            </NoticeBar>
          )}
        </form>
      )}
    </Modal>
  );
}

/**
 * Результат готов, но задание правил человек. Заменять его работу молча нельзя, поэтому
 * выбор явный — и «оставить как есть» не теряет результат: применить его можно позже.
 */
function AwaitingDecision({
  busy,
  onApply,
  onKeep,
}: {
  busy: boolean;
  onApply: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <NoticeBar tone="soft">
        Вы правили задание после прошлой генерации, поэтому новый вариант не применён
        автоматически. Посмотрите его и решите сами — ваш текст пока на месте.
      </NoticeBar>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onKeep} disabled={busy}>
          Оставить как есть
        </Button>
        <Button onClick={onApply} loading={busy}>
          Заменить мой текст
        </Button>
      </div>
    </div>
  );
}

function MaterialPicker({
  loading,
  materials,
  selected,
  onToggle,
}: {
  loading: boolean;
  materials: { id?: number; fileName?: string; url?: string; kind?: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  if (loading) return <LoadingBlock label="Загрузка материалов урока…" />;

  if (materials.length === 0) {
    return (
      <EmptyBlock
        title="У урока нет материалов"
        description="Модель составит задание по теме урока. Приложите конспект или презентацию к уроку — и результат станет точнее."
      />
    );
  }

  return (
    <Field label="Материалы урока">
      <ul className="flex flex-col gap-2">
        {materials.map((material) => (
          <li key={material.id}>
            <label className="flex cursor-pointer items-center gap-2.5 text-13 text-ink">
              <input
                type="checkbox"
                checked={material.id != null && selected.has(material.id)}
                onChange={() => material.id != null && onToggle(material.id)}
                className="size-4 rounded border-slate-300"
              />
              <span className="truncate">{material.fileName ?? material.url}</span>
            </label>
          </li>
        ))}
      </ul>
    </Field>
  );
}
