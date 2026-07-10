import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { EmptyBlock, LoadingBlock, Spinner } from '@/components/ui/StateBlock';
import {
  useGenerateTest,
  useGenerationJob,
  useMaterials,
  keys,
} from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { GenerationJobStatus, QuestionDifficulty, Test } from '@/lib/types';
import { QUESTION_DIFFICULTIES, QUESTION_DIFFICULTY_LABELS } from '@/lib/testQuestions';

type GenQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';

const TYPE_OPTIONS: { value: GenQuestionType; label: string }[] = [
  { value: 'SINGLE_CHOICE', label: 'Один вариант' },
  { value: 'MULTIPLE_CHOICE', label: 'Несколько вариантов' },
];

const STATUS_LABELS: Record<GenerationJobStatus, string> = {
  PENDING: 'Задача в очереди…',
  RUNNING: 'Генерация вопросов…',
  DONE: 'Готово',
  FAILED: 'Ошибка генерации',
};

export function TestGenerateModal({
  open,
  onClose,
  test,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  test: Test;
  onComplete?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const generate = useGenerateTest();
  const { data: materials, isLoading: materialsLoading } = useMaterials(test.subjectId);

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<Set<GenQuestionType>>(
    new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  );
  const [difficulty, setDifficulty] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const handledJobRef = useRef<number | null>(null);

  const { data: job } = useGenerationJob(open ? jobId : null);
  const readyMaterials = (materials ?? []).filter((m) => m.status === 'READY');
  const isGenerating = jobId != null && job?.status !== 'DONE' && job?.status !== 'FAILED';

  useEffect(() => {
    if (!open) return;
    setSelectedMaterialIds(new Set());
    setCount(10);
    setTypes(new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']));
    setDifficulty('');
    setTopic('');
    setError(null);
    setJobId(null);
    handledJobRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!job || handledJobRef.current === job.id) return;
    if (job.status === 'DONE') {
      handledJobRef.current = job.id;
      void qc.invalidateQueries({ queryKey: keys.test(test.id) });
      void qc.invalidateQueries({ queryKey: keys.tests });
      toast.success('Вопросы сгенерированы');
      onComplete?.();
      onClose();
    }
  }, [job, test.id, qc, toast, onComplete, onClose]);

  function toggleMaterial(id: number) {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleType(type: GenQuestionType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function selectAllMaterials() {
    setSelectedMaterialIds(new Set(readyMaterials.map((m) => m.id)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedMaterialIds.size === 0) {
      setError('Выберите хотя бы один материал');
      return;
    }
    if (types.size === 0) {
      setError('Выберите хотя бы один тип вопроса');
      return;
    }
    if (count < 1 || count > 50) {
      setError('Количество вопросов — от 1 до 50');
      return;
    }

    setError(null);
    try {
      const result = await generate.mutateAsync({
        testId: test.id,
        body: {
          materialIds: [...selectedMaterialIds],
          count,
          types: [...types],
          difficulty: difficulty ? (difficulty as QuestionDifficulty) : null,
          topic: topic.trim() || null,
        },
      });
      setJobId(result.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось запустить генерацию');
    }
  }

  function resetToForm() {
    setJobId(null);
    setError(null);
    handledJobRef.current = null;
  }

  const footer =
    job?.status === 'FAILED' ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
        <Button onClick={resetToForm}>Попробовать снова</Button>
      </>
    ) : isGenerating ? (
      <span className="text-xs text-slate-400">Генерация выполняется…</span>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose} disabled={generate.isPending}>
          Отмена
        </Button>
        <Button
          form="test-generate-form"
          type="submit"
          icon={<Sparkles className="h-4 w-4" />}
          loading={generate.isPending}
          disabled={readyMaterials.length === 0}
        >
          Сгенерировать
        </Button>
      </>
    );

  return (
    <Modal
      open={open}
      onClose={isGenerating ? () => {} : onClose}
      title="Сгенерировать вопросы"
      subtitle={`${test.title} · ${test.subjectName}`}
      footer={footer}
    >
      {isGenerating || job?.status === 'FAILED' ? (
        <div className="space-y-4">
          {job?.status === 'FAILED' ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {job.errorMessage ?? 'Генерация завершилась с ошибкой'}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Spinner className="h-8 w-8" />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {job ? STATUS_LABELS[job.status] : 'Запуск генерации…'}
                </p>
                <p className="mt-1 text-xs text-slate-400">Обычно занимает 1–3 минуты. Не закрывайте окно.</p>
              </div>
            </div>
          )}
        </div>
      ) : materialsLoading ? (
        <LoadingBlock label="Загрузка материалов…" />
      ) : readyMaterials.length === 0 ? (
        <EmptyBlock
          title="Нет готовых материалов"
          description="Загрузите файлы в библиотеку предмета и дождитесь завершения извлечения текста."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                navigate(`/subjects/${test.subjectId}/materials`);
              }}
            >
              Открыть материалы
            </Button>
          }
        />
      ) : (
        <form id="test-generate-form" onSubmit={onSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Материалы <span className="text-red-500">*</span>
              </p>
              <button
                type="button"
                onClick={selectAllMaterials}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Выбрать все
              </button>
            </div>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl ring-1 ring-slate-200">
              {readyMaterials.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedMaterialIds.has(m.id)}
                      onChange={() => toggleMaterial(m.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{m.title}</span>
                      {m.topic && <span className="block text-xs text-slate-400">{m.topic}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <Field label="Количество вопросов" required>
            <TextInput
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Типы вопросов <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={types.has(opt.value)}
                    onChange={() => toggleType(opt.value)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сложность" hint="Необязательно">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Любая</option>
                {QUESTION_DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {QUESTION_DIFFICULTY_LABELS[level]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Тема" hint="Необязательно">
              <TextInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Например, Кинематика"
              />
            </Field>
          </div>
        </form>
      )}
    </Modal>
  );
}
