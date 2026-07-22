import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import {
  commitImportRun,
  isImportAnalyzing,
  isImportProcessing,
  listImportErrors,
  listImportTypes,
  pollImportRun,
  uploadImportRun,
} from '../services';
import type {
  ImportDuplicateStrategy,
  ImportRunDetail,
  ImportRunError,
  ImportType,
  ImportTypeInfo,
} from '../types';

type Phase = 'idle' | 'loading' | 'error' | 'done';

const TYPE_ORDER: ImportType[] = [
  'STUDENTS_WITH_PARENTS',
  'STUDENTS',
  'PARENTS',
  'TEACHERS',
  'CLASSES',
];

const TYPE_META: Record<
  ImportType,
  { title: string; description: string }
> = {
  STUDENTS_WITH_PARENTS: {
    title: 'Ученики + родители',
    description: 'Импорт учеников вместе с привязанными родителями.',
  },
  STUDENTS: {
    title: 'Только ученики',
    description: 'Создание и обновление списка учеников.',
  },
  PARENTS: {
    title: 'Только родители',
    description: 'Создание родителей и связь с учениками.',
  },
  TEACHERS: {
    title: 'Учителя',
    description: 'Импорт преподавателей, предметов и классов.',
  },
  CLASSES: {
    title: 'Классы',
    description: 'Импорт структуры классов и учебных годов.',
  },
};

const MAX_BYTES = 10 * 1024 * 1024;

function guessMapping(
  fields: ImportTypeInfo['fields'],
  columns: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of fields) {
    const byLabel = columns.find(
      (c) =>
        !used.has(c) &&
        (c.toLowerCase() === field.label.toLowerCase() ||
          c.toLowerCase() === field.key.toLowerCase()),
    );
    if (byLabel) {
      mapping[field.key] = byLabel;
      used.add(byLabel);
      continue;
    }
    const fuzzy = columns.find(
      (c) =>
        !used.has(c) &&
        (c.toLowerCase().includes(field.label.toLowerCase().slice(0, 4)) ||
          field.label.toLowerCase().includes(c.toLowerCase().slice(0, 4))),
    );
    if (fuzzy && field.required) {
      mapping[field.key] = fuzzy;
      used.add(fuzzy);
    }
  }
  return mapping;
}

export function ImportPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [types, setTypes] = useState<ImportTypeInfo[]>([]);
  const [importType, setImportType] = useState<ImportType>('STUDENTS_WITH_PARENTS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(40);

  const [phase, setPhase] = useState<Phase>('idle');
  const [activeRun, setActiveRun] = useState<ImportRunDetail | null>(null);
  const [errors, setErrors] = useState<ImportRunError[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);

  const availableTypes = useMemo(() => {
    const fromApi = new Map(types.map((t) => [t.type, t]));
    return TYPE_ORDER.filter((t) => fromApi.has(t)).map((t) => ({
      type: t,
      ...TYPE_META[t],
      fields: fromApi.get(t)!.fields,
    }));
  }, [types]);

  const selectedTypeInfo = types.find((t) => t.type === importType) ?? null;
  const canImport = Boolean(selectedFile && importType && phase === 'idle');

  useEffect(() => {
    void listImportTypes()
      .then((list) => {
        setTypes(list);
        const preferred = TYPE_ORDER.find((t) => list.some((x) => x.type === t));
        if (preferred) setImportType(preferred);
        else if (list[0]) setImportType(list[0].type);
      })
      .catch((err) =>
        setTypesError(err instanceof Error ? err.message : 'Не удалось загрузить типы импорта'),
      );
  }, []);

  useEffect(() => {
    if (phase !== 'loading') return;
    setProgress(35);
    const id = window.setInterval(() => {
      setProgress((p) => (p >= 90 ? 40 : p + 8));
    }, 400);
    return () => window.clearInterval(id);
  }, [phase]);

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setActiveRun(null);
    setErrors([]);
    setErrorMessage(null);
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const onFileChosen = useCallback((file: File | null) => {
    setErrorMessage(null);
    setActiveRun(null);
    setErrors([]);
    setPhase('idle');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!/\.(xlsx|xls)$/.test(lower)) {
      setSelectedFile(null);
      setErrorMessage('Поддерживаются только файлы .xlsx и .xls');
      setPhase('error');
      return;
    }
    if (file.size > MAX_BYTES) {
      setSelectedFile(null);
      setErrorMessage('Максимальный размер файла — 10 MB');
      setPhase('error');
      return;
    }
    setSelectedFile(file);
  }, []);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    onFileChosen(e.dataTransfer.files?.[0] ?? null);
  }

  async function runImport() {
    if (!selectedFile || !importType || !selectedTypeInfo) {
      setErrorMessage('Выберите тип импорта и файл');
      setPhase('error');
      return;
    }

    setPhase('loading');
    setErrorMessage(null);
    setActiveRun(null);
    setErrors([]);

    try {
      const accepted = await uploadImportRun(importType, selectedFile);
      const analyzed = await pollImportRun(
        accepted.id,
        (r) => !isImportAnalyzing(r.status) || r.status === 'ANALYSIS_FAILED',
      );

      if (analyzed.status === 'ANALYSIS_FAILED') {
        setActiveRun(analyzed);
        setErrorMessage(analyzed.errorMessage || 'Не удалось обработать файл');
        setPhase('error');
        return;
      }

      if (analyzed.status !== 'PREVIEW_READY') {
        setActiveRun(analyzed);
        setErrorMessage(`Неожиданный статус: ${analyzed.status}`);
        setPhase('error');
        return;
      }

      const mapping =
        analyzed.mapping && Object.keys(analyzed.mapping).length > 0
          ? analyzed.mapping
          : guessMapping(selectedTypeInfo.fields, analyzed.columnNames);

      for (const field of selectedTypeInfo.fields) {
        if (field.required && !mapping[field.key]) {
          setActiveRun(analyzed);
          setErrorMessage(
            `Не удалось сопоставить обязательное поле «${field.label}». Проверьте колонки файла.`,
          );
          setPhase('error');
          return;
        }
      }

      const strategy: ImportDuplicateStrategy = analyzed.duplicateStrategy ?? 'UPDATE';
      await commitImportRun(analyzed.id, mapping, strategy);
      const finished = await pollImportRun(
        analyzed.id,
        (r) => !isImportProcessing(r.status),
        { maxAttempts: 120 },
      );

      setActiveRun(finished);
      if (finished.errorCount > 0 || finished.status === 'COMPLETED_WITH_ERRORS' || finished.status === 'FAILED') {
        setErrors(await listImportErrors(finished.id));
      } else {
        setErrors([]);
      }

      if (finished.status === 'FAILED') {
        setErrorMessage(finished.errorMessage || 'Импорт завершился с ошибкой');
        setPhase('error');
        return;
      }

      setPhase('done');
      if (finished.status === 'COMPLETED') {
        toast.success('Импорт завершён');
      } else {
        toast.info(`Импорт завершён с ошибками: ${finished.errorCount}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось обработать файл');
      setPhase('error');
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <Link to="/admin/users" className="font-medium text-slate-400 hover:text-brand-600">
          Пользователи
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-300" />
        <span className="font-semibold text-navy-700">Импорт из Excel</span>
      </div>
      <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">Импорт данных</h1>

      {typesError && (
        <p className="mt-4 text-sm text-red-500">{typesError}</p>
      )}

      <div className="mt-6 space-y-6">
        {/* 1. Type selection */}
        <section className="card space-y-4 p-6">
          <h2 className="text-base font-bold text-slate-900">1. Выберите тип импорта</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(availableTypes.length > 0
              ? availableTypes
              : TYPE_ORDER.map((t) => ({ type: t, ...TYPE_META[t], fields: [] }))
            ).map((item) => {
              const selected = importType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  disabled={phase === 'loading'}
                  onClick={() => {
                    setImportType(item.type);
                    if (phase === 'done' || phase === 'error') resetUpload();
                  }}
                  className={cx(
                    'flex h-[110px] flex-col gap-2 rounded-xl p-4 text-left transition',
                    selected
                      ? 'border-2 border-navy-700 bg-[#eff6ff]'
                      : 'border border-slate-200 bg-white hover:border-slate-300',
                    phase === 'loading' && 'opacity-70',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText
                        className={cx(
                          'h-[18px] w-[18px]',
                          selected ? 'text-navy-700' : 'text-slate-400',
                        )}
                      />
                      <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                    </div>
                    {selected && (
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[9px] bg-navy-700">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{item.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Upload / loading / error / results */}
        <section className="card space-y-4 p-6">
          <h2 className="text-base font-bold text-slate-900">2. Загрузка Excel-файла</h2>

          {phase === 'idle' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-12 transition',
                dragging
                  ? 'border-navy-700 bg-[#eff6ff]'
                  : 'border-slate-200 bg-slate-50',
              )}
            >
              <FileSpreadsheet className="h-12 w-12 text-slate-300" />
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Перетащите файл сюда'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(0)} КБ`
                    : 'или нажмите «Выбрать файл»'}
                </p>
              </div>
              <Button onClick={() => inputRef.current?.click()}>Выбрать файл</Button>
              <p className="text-xs text-slate-400">
                Поддерживаются файлы .xlsx и .xls · Максимум 10 MB
              </p>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-slate-200 bg-slate-50 px-6 py-16">
              <div className="flex h-12 w-12 items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-navy-700" strokeWidth={2} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900">Проверяем файл...</p>
                <p className="mt-2 text-sm text-slate-500">
                  Анализируем строки и сопоставляем контакты
                </p>
              </div>
              <div className="h-1.5 w-60 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-navy-700 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-red-500 bg-red-50 px-6 py-14">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="max-w-md text-center">
                <p className="text-base font-bold text-red-500">Не удалось обработать файл</p>
                <p className="mt-1.5 text-sm text-slate-500">
                  {errorMessage ||
                    'Проверьте формат файла, структуру колонок и повторите попытку.'}
                </p>
              </div>
              <Button
                onClick={() => {
                  resetUpload();
                  window.setTimeout(() => inputRef.current?.click(), 0);
                }}
              >
                Повторить загрузку
              </Button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
          />

          {phase === 'done' && activeRun && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-bold text-slate-900">Результат проверки</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatTile
                  label="Всего записей"
                  value={activeRun.totalRows ?? activeRun.processedRows}
                  tone="blue"
                />
                <StatTile label="Создано" value={activeRun.createdCount} tone="green" />
                <StatTile label="Обновлено" value={activeRun.updatedCount} tone="orange" />
                <StatTile label="Пропущено" value={activeRun.skippedCount} tone="gray" />
                <StatTile label="Ошибок" value={activeRun.errorCount} tone="red" />
              </div>

              {errors.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase text-slate-400">
                    <span className="w-[100px] shrink-0">Строка</span>
                    <span className="w-[180px] shrink-0">Поле</span>
                    <span className="min-w-0 flex-1">Описание ошибки</span>
                  </div>
                  <ul>
                    {errors.map((err, i) => (
                      <li
                        key={`${err.rowNumber}-${err.field}-${i}`}
                        className="flex border-t border-slate-100 bg-red-50 px-4 py-3 text-[13px]"
                      >
                        <span className="w-[100px] shrink-0 font-semibold text-red-500">
                          Строка {err.rowNumber}
                        </span>
                        <span className="w-[180px] shrink-0 font-semibold text-slate-900">
                          {err.field ?? '—'}
                        </span>
                        <span className="min-w-0 flex-1 text-slate-500">{err.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
        <Button
          variant="secondary"
          onClick={() => {
            if (phase === 'done') {
              navigate('/admin/users');
              return;
            }
            if (phase === 'error') {
              resetUpload();
              return;
            }
            navigate('/admin/users');
          }}
          disabled={phase === 'loading'}
        >
          Отмена
        </Button>
        {phase === 'done' ? (
          <Button onClick={() => navigate('/admin/users')}>Готово</Button>
        ) : (
          <Button
            onClick={() => void runImport()}
            loading={phase === 'loading'}
            disabled={!canImport}
            className={!canImport && phase === 'idle' ? 'bg-slate-200 text-slate-400 hover:bg-slate-200' : undefined}
          >
            Импортировать
          </Button>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'orange' | 'gray' | 'red';
}) {
  const tones = {
    blue: 'bg-[#eff6ff] text-navy-700',
    green: 'bg-emerald-50 text-emerald-500',
    orange: 'bg-orange-50 text-brand-500',
    gray: 'bg-slate-50 text-slate-500',
    red: 'bg-red-50 text-red-500',
  };
  const labelTone = {
    blue: 'text-navy-700',
    green: 'text-emerald-500',
    orange: 'text-brand-500',
    gray: 'text-slate-400',
    red: 'text-red-500',
  };
  return (
    <div className={cx('flex flex-col gap-1 rounded-lg p-3', tones[tone])}>
      <p className={cx('text-[11px] font-semibold uppercase', labelTone[tone])}>{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
