import { useCallback, useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import { IMPORT_TYPE_LABELS } from '../labels';
import { runMockImport } from '../services';
import type { ImportEntityType, ImportResult, ImportRowSeverity } from '../types';

const TYPES: ImportEntityType[] = ['STUDENTS', 'PARENTS', 'TEACHERS', 'CLASSES'];

const SEVERITY_LABEL: Record<ImportRowSeverity, string> = {
  OK: 'OK',
  WARNING: 'Предупреждение',
  ERROR: 'Ошибка',
};

const SEVERITY_CLASS: Record<ImportRowSeverity, string> = {
  OK: 'text-emerald-700',
  WARNING: 'text-amber-700',
  ERROR: 'text-red-600',
};

export function ImportPage() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entityType, setEntityType] = useState<ImportEntityType>('STUDENTS');
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFileChosen = useCallback((file: File | null) => {
    setError(null);
    setResult(null);
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
    const file = e.dataTransfer.files?.[0] ?? null;
    onFileChosen(file);
  }

  async function runImport() {
    if (!selectedFile) {
      setError('Сначала выберите файл');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await runMockImport(entityType, selectedFile);
      setResult(next);
      if (next.errorCount === 0) {
        toast.success('Импорт завершён без ошибок (mock)');
      } else {
        toast.info(`Импорт завершён: ${next.errorCount} ошибок, ${next.warningCount} предупреждений`);
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Не удалось выполнить импорт');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        UI-заготовка импорта Excel. Файл не парсится на сервере — показывается mock-результат для
        выбранного типа (см. docs/qa-fixtures).
      </p>

      <div className="mb-4 max-w-xs">
        <label className="label-base">Тип импорта</label>
        <Select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as ImportEntityType);
            setResult(null);
            setError(null);
          }}
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {IMPORT_TYPE_LABELS[type]}
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
          {selectedFile ? <FileSpreadsheet className="h-7 w-7 text-brand-500" /> : <Upload className="h-7 w-7" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {selectedFile ? selectedFile.name : 'Перетащите Excel сюда или выберите файл'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            .xlsx / .xls / .csv · тип: {IMPORT_TYPE_LABELS[entityType]}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Выбрать файл
          </Button>
          <Button size="sm" onClick={() => void runImport()} loading={loading} disabled={!selectedFile}>
            Запустить импорт
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

      {loading && <LoadingBlock label="Импорт…" />}
      {error && !loading && (
        <div className="mt-4">
          <ErrorBlock message={error} onRetry={() => selectedFile && void runImport()} />
        </div>
      )}

      {!loading && !error && !result && (
        <div className="card mt-4">
          <EmptyBlock
            title="Результата ещё нет"
            description="Выберите тип импорта, загрузите файл из docs/qa-fixtures и нажмите «Запустить импорт»."
          />
        </div>
      )}

      {!loading && result && (
        <div className="mt-4 space-y-4">
          {result.errorCount === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Импорт «{IMPORT_TYPE_LABELS[result.entityType]}» завершён успешно для файла{' '}
              <span className="font-semibold">{result.fileName}</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
              Импорт завершён с замечаниями. Проверьте строки с ошибками и предупреждениями ниже.
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">
              Успешно: {result.successCount}
            </span>
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">
              Предупреждения: {result.warningCount}
            </span>
            <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">
              Ошибки: {result.errorCount}
            </span>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Строка</th>
                  <th className="px-4 py-3 font-semibold">Сущность</th>
                  <th className="px-4 py-3 font-semibold">Уровень</th>
                  <th className="px-4 py-3 font-semibold">Сообщение</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={`${row.row}-${row.message}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{row.row}</td>
                    <td className="px-4 py-3 text-slate-900">{row.entityLabel || '—'}</td>
                    <td className={cx('px-4 py-3 font-medium', SEVERITY_CLASS[row.severity])}>
                      {SEVERITY_LABEL[row.severity]}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
