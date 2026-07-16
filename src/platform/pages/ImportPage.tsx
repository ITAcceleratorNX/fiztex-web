import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import { IMPORT_RUN_STATUS_LABELS } from '../labels';
import {
  commitImportRun,
  isImportAnalyzing,
  isImportProcessing,
  listImportErrors,
  listImportRuns,
  listImportTypes,
  pollImportRun,
  uploadImportRun,
} from '../services';
import type {
  ImportDuplicateStrategy,
  ImportRun,
  ImportRunDetail,
  ImportRunError,
  ImportType,
  ImportTypeInfo,
} from '../types';

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
    // fuzzy: column contains label words
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
  const inputRef = useRef<HTMLInputElement>(null);

  const [types, setTypes] = useState<ImportTypeInfo[]>([]);
  const [importType, setImportType] = useState<ImportType | ''>('');
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const [phase, setPhase] = useState<'idle' | 'uploading' | 'mapping' | 'committing' | 'done'>(
    'idle',
  );
  const [activeRun, setActiveRun] = useState<ImportRunDetail | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<ImportDuplicateStrategy>('SKIP');
  const [errors, setErrors] = useState<ImportRunError[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);

  const selectedTypeInfo = types.find((t) => t.type === importType) ?? null;

  const reloadRuns = useCallback(async () => {
    try {
      const list = await listImportRuns();
      setRuns(list);
    } catch {
      /* ignore list errors on side panel */
    }
  }, []);

  useEffect(() => {
    void listImportTypes()
      .then((list) => {
        setTypes(list);
        if (list.length > 0) setImportType(list[0].type);
      })
      .catch((err) =>
        setTypesError(err instanceof Error ? err.message : 'Не удалось загрузить типы импорта'),
      );
    void reloadRuns();
  }, [reloadRuns]);

  const onFileChosen = useCallback((file: File | null) => {
    setError(null);
    setActiveRun(null);
    setErrors([]);
    setPhase('idle');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(lower)) {
      setSelectedFile(null);
      setError('Выберите файл .xlsx, .xls или .csv');
      return;
    }
    setSelectedFile(file);
  }, []);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    onFileChosen(e.dataTransfer.files?.[0] ?? null);
  }

  async function startUpload() {
    if (!selectedFile || !importType) {
      setError('Выберите тип и файл');
      return;
    }
    setPhase('uploading');
    setError(null);
    setActiveRun(null);
    setErrors([]);
    try {
      const accepted = await uploadImportRun(importType, selectedFile);
      const run = await pollImportRun(
        accepted.id,
        (r) => !isImportAnalyzing(r.status) || r.status === 'ANALYSIS_FAILED',
      );
      setActiveRun(run);
      if (run.status === 'ANALYSIS_FAILED') {
        setError(run.errorMessage || 'Анализ файла не удался');
        setPhase('idle');
        return;
      }
      if (run.status !== 'PREVIEW_READY') {
        setError(`Неожиданный статус: ${run.status}`);
        setPhase('idle');
        return;
      }
      const typeInfo = types.find((t) => t.type === importType);
      const fields = typeInfo?.fields ?? [];
      const initial =
        run.mapping && Object.keys(run.mapping).length > 0
          ? run.mapping
          : guessMapping(fields, run.columnNames);
      setMapping(initial);
      setDuplicateStrategy(run.duplicateStrategy ?? 'SKIP');
      setPhase('mapping');
      await reloadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setPhase('idle');
    }
  }

  async function startCommit() {
    if (!activeRun || !selectedTypeInfo) return;
    for (const field of selectedTypeInfo.fields) {
      if (field.required && !mapping[field.key]) {
        setError(`Сопоставьте обязательное поле: ${field.label}`);
        return;
      }
    }
    setPhase('committing');
    setError(null);
    try {
      await commitImportRun(activeRun.id, mapping, duplicateStrategy);
      const run = await pollImportRun(activeRun.id, (r) => !isImportProcessing(r.status), {
        maxAttempts: 120,
      });
      setActiveRun(run);
      if (run.errorCount > 0 || run.status === 'COMPLETED_WITH_ERRORS' || run.status === 'FAILED') {
        const errs = await listImportErrors(run.id);
        setErrors(errs);
      } else {
        setErrors([]);
      }
      setPhase('done');
      if (run.status === 'COMPLETED') {
        toast.success('Импорт завершён');
      } else if (run.status === 'COMPLETED_WITH_ERRORS') {
        toast.info(`Импорт завершён с ошибками: ${run.errorCount}`);
      } else {
        toast.error(run.errorMessage || 'Импорт завершился с ошибкой');
      }
      await reloadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка commit');
      setPhase('mapping');
    }
  }

  const busy = phase === 'uploading' || phase === 'committing';

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Реальный импорт через API: загрузка → сопоставление колонок → commit. Типы и поля
        приходят с сервера.
      </p>

      {typesError && (
        <div className="mb-4">
          <ErrorBlock message={typesError} />
        </div>
      )}

      <div className="mb-4 max-w-xs">
        <label className="label-base">Тип импорта</label>
        <Select
          value={importType}
          onChange={(e) => {
            setImportType(e.target.value as ImportType);
            setActiveRun(null);
            setPhase('idle');
            setError(null);
          }}
          disabled={busy || types.length === 0}
        >
          {types.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'card flex flex-col items-center justify-center gap-3 border-dashed py-12 text-center transition',
          dragging && 'ring-2 ring-brand-400/40',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {selectedFile ? (
            <FileSpreadsheet className="h-7 w-7 text-brand-500" />
          ) : (
            <Upload className="h-7 w-7" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {selectedFile ? selectedFile.name : 'Перетащите Excel сюда или выберите файл'}
          </p>
          <p className="mt-1 text-xs text-slate-500">.xlsx / .xls / .csv</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Выбрать файл
          </Button>
          <Button
            size="sm"
            onClick={() => void startUpload()}
            loading={phase === 'uploading'}
            disabled={!selectedFile || !importType || busy}
          >
            Загрузить и проанализировать
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
        />
      </div>

      {busy && (
        <div className="mt-4">
          <LoadingBlock
            label={phase === 'uploading' ? 'Анализ файла…' : 'Импорт выполняется…'}
          />
        </div>
      )}
      {error && !busy && (
        <div className="mt-4">
          <ErrorBlock message={error} />
        </div>
      )}

      {phase === 'mapping' && activeRun && selectedTypeInfo && (
        <div className="card mt-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Сопоставление колонок</h2>
            <p className="text-xs text-slate-500">
              Файл: {activeRun.fileName} · строк: {activeRun.totalRows ?? '—'}
            </p>
          </div>
          <div className="space-y-3">
            {selectedTypeInfo.fields.map((field) => (
              <Field
                key={field.key}
                label={`${field.label}${field.required ? ' *' : ''}`}
              >
                <Select
                  value={mapping[field.key] ?? ''}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                >
                  <option value="">— не сопоставлять —</option>
                  {activeRun.columnNames.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <Field label="Дубликаты">
            <Select
              value={duplicateStrategy}
              onChange={(e) =>
                setDuplicateStrategy(e.target.value as ImportDuplicateStrategy)
              }
            >
              <option value="SKIP">Пропускать (SKIP)</option>
              <option value="UPDATE">Обновлять (UPDATE)</option>
            </Select>
          </Field>
          <Button onClick={() => void startCommit()} disabled={busy}>
            Запустить импорт
          </Button>
        </div>
      )}

      {phase === 'done' && activeRun && (
        <div className="mt-4 space-y-4">
          {activeRun.status === 'COMPLETED' ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Импорт «{activeRun.importTypeLabel}» завершён для{' '}
              <span className="font-semibold">{activeRun.fileName}</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
              Статус: {IMPORT_RUN_STATUS_LABELS[activeRun.status]}
              {activeRun.errorMessage ? ` — ${activeRun.errorMessage}` : ''}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">
              Создано: {activeRun.createdCount}
            </span>
            <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-sky-700">
              Обновлено: {activeRun.updatedCount}
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              Пропущено: {activeRun.skippedCount}
            </span>
            <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">
              Ошибки: {activeRun.errorCount}
            </span>
          </div>
          {errors.length > 0 && (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Строка</th>
                    <th className="px-4 py-3 font-semibold">Поле</th>
                    <th className="px-4 py-3 font-semibold">Код</th>
                    <th className="px-4 py-3 font-semibold">Сообщение</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((row, i) => (
                    <tr key={`${row.rowNumber}-${i}`} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 text-slate-600">{row.rowNumber}</td>
                      <td className="px-4 py-3 text-slate-900">{row.field || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{row.errorCode}</td>
                      <td className="px-4 py-3 text-slate-500">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Последние запуски</h2>
        {runs.length === 0 ? (
          <div className="card">
            <EmptyBlock title="Запусков пока нет" description="Загрузите первый файл." />
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Тип</th>
                  <th className="px-4 py-3 font-semibold">Файл</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold">Создано / ошибки</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{run.id}</td>
                    <td className="px-4 py-3">{run.importTypeLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{run.fileName}</td>
                    <td className="px-4 py-3">{IMPORT_RUN_STATUS_LABELS[run.status]}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {run.createdCount} / {run.errorCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
