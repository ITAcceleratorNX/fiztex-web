import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { useToast } from '@/context/ToastContext';
import {
  useCheckTextbookDuplicate,
  useCreateTextbookBindings,
  useUploadTextbook,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import {
  TEXTBOOK_ACCEPT,
  WHOLE_YEAR,
  buildBindingsRequest,
  classOptions,
  defaultPeriodId,
  defaultYear,
  describeBatch,
  findYear,
  sha256Hex,
  subjectOptions,
  textbookFileProblem,
  titleFromFileName,
} from '@/lib/textbookModel';
import { TEXTBOOK_ERRORS, type BindingOptions, type Textbook } from '@/lib/textbooksApi';

const TITLE_MAX = 300;

/** Что назначили — таблица встаёт на эти фильтры. */
export type SavedBinding = { yearId: number; period: string; subjectId: number; classIds: number[] };

/**
 * «Добавить учебник» и «Использовать существующий учебник» (Figma 2149:3200, 2149:3340,
 * 2149:3482, 2149:3630) — одно окно в двух режимах.
 *
 * Для учителя это одно действие, а на бэкенде два ресурса: файл в библиотеке и назначение
 * классам. «Сохранить» делает оба запроса подряд. Если назначение не прошло после удачной
 * загрузки, окно переходит в режим «существующего» с только что загруженным учебником —
 * повторное нажатие не отправит файл второй раз.
 *
 * Дубль ловится дважды, как требует контракт §3: по SHA-256 сразу после выбора файла и ответом
 * `409 TEXTBOOK_DUPLICATE` на самой загрузке. Настаивающему — загрузка с `allowDuplicate`:
 * предупреждение показано, и «Сохранить» поверх него — осознанный выбор.
 *
 * Предмет учебника в режиме «существующего» не меняется: предмет назначения всегда равен
 * предмету учебника (составной ключ в БД), и другой выбор сервер бы отклонил.
 */
export function AddTextbookModal({
  open,
  onClose,
  options,
  prefill,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  options: BindingOptions | undefined;
  /** Фильтры таблицы: окно открывается там, где учитель уже стоит. */
  prefill: { yearId?: number; periodId?: number; subjectId?: number; classId?: number };
  onSaved: (saved: SavedBinding) => void;
}) {
  const toast = useToast();
  const upload = useUploadTextbook();
  const checkDuplicate = useCheckTextbookDuplicate();
  const createBindings = useCreateTextbookBindings();

  const [existing, setExisting] = useState<Textbook | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duplicate, setDuplicate] = useState<Textbook | null>(null);
  const [checking, setChecking] = useState(false);
  const [yearId, setYearId] = useState<number | null>(null);
  const [period, setPeriod] = useState('');
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [classIds, setClassIds] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Файл, чей хэш сейчас считается: ответ по уже заменённому файлу выбрасывается. */
  const checkingFile = useRef<File | null>(null);

  // Каждое открытие начинается с чистой формы на фильтрах таблицы.
  useEffect(() => {
    if (!open) return;
    const year = findYear(options, prefill.yearId) ?? defaultYear(options);
    const prefillPeriod = year?.periods?.some((item) => item.id === prefill.periodId) ? prefill.periodId : undefined;
    setExisting(null);
    setTitle('');
    setFile(null);
    setDuplicate(null);
    setChecking(false);
    setYearId(year?.id ?? null);
    setPeriod(String(prefillPeriod ?? defaultPeriodId(year) ?? ''));
    setSubjectId(prefill.subjectId ?? null);
    setClassIds(prefill.classId != null ? [prefill.classId] : []);
    setSubmitted(false);
    setFormError(null);
    checkingFile.current = null;
    // Сброс — только на открытие: фильтры под окном во время ввода не меняются.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const year = findYear(options, yearId);
  const lockedSubjectId = existing?.subjectId ?? null;
  const effectiveSubjectId = lockedSubjectId ?? subjectId;
  const subjects = existing
    ? [{ value: String(existing.subjectId), label: existing.subjectName ?? '' }]
    : subjectOptions(year, classIds);
  const classes = classOptions(year, effectiveSubjectId);

  const fileProblem = file ? textbookFileProblem(file) : null;
  const errors = {
    title: existing ? null : !title.trim() ? 'Укажите название' : null,
    file: existing ? null : (fileProblem ?? (file ? null : 'Выберите файл')),
    classes: classIds.length === 0 ? 'Выберите хотя бы один класс' : null,
    subject: effectiveSubjectId == null ? 'Выберите предмет' : null,
    year: yearId == null ? 'Выберите учебный год' : null,
    period: !period ? 'Выберите период' : null,
  };
  const shown = (error: string | null) => (submitted ? (error ?? undefined) : undefined);
  const saving = upload.isPending || createBindings.isPending;

  async function changeFile(next: File | null) {
    setFile(next);
    setDuplicate(null);
    setFormError(null);
    checkingFile.current = next;
    if (!next || textbookFileProblem(next)) {
      setChecking(false);
      return;
    }
    if (!title.trim()) setTitle(titleFromFileName(next.name));

    setChecking(true);
    try {
      const result = await checkDuplicate.mutateAsync(await sha256Hex(next));
      if (checkingFile.current === next && result.duplicate && result.textbook) setDuplicate(result.textbook);
    } catch {
      // Проверка — только подсказка: сервер повторит её на загрузке и ответит 409.
    } finally {
      if (checkingFile.current === next) setChecking(false);
    }
  }

  function changeYear(value: string) {
    const next = findYear(options, Number(value));
    setYearId(next?.id ?? null);
    setPeriod(String(defaultPeriodId(next) ?? ''));
    // Пары «класс + предмет» у каждого года свои: выбор другого года здесь уже ничего не значит.
    const allowedClasses = new Set(classOptions(next, effectiveSubjectId).map((option) => Number(option.value)));
    setClassIds((ids) => ids.filter((id) => allowedClasses.has(id)));
    if (!existing && subjectId != null && !subjectOptions(next, []).some((option) => Number(option.value) === subjectId)) {
      setSubjectId(null);
    }
  }

  function switchToExisting() {
    if (!duplicate) return;
    const allowedClasses = new Set(
      classOptions(year, duplicate.subjectId ?? null).map((option) => Number(option.value)),
    );
    setExisting(duplicate);
    setFile(null);
    setDuplicate(null);
    setChecking(false);
    checkingFile.current = null;
    setClassIds((ids) => ids.filter((id) => allowedClasses.has(id)));
    setSubmitted(false);
    setFormError(null);
  }

  async function save() {
    setSubmitted(true);
    setFormError(null);
    if (Object.values(errors).some(Boolean) || yearId == null || effectiveSubjectId == null) return;

    let textbook = existing;
    if (!textbook) {
      try {
        textbook = await upload.mutateAsync({
          file: file as File,
          title: title.trim(),
          subjectId: effectiveSubjectId,
          allowDuplicate: duplicate != null,
        });
      } catch (error) {
        const existingOne = duplicateFrom(error);
        if (existingOne) {
          setDuplicate(existingOne);
          return;
        }
        setFormError(messageOf(error, 'Не удалось загрузить учебник'));
        return;
      }
      setExisting(textbook);
      setFile(null);
      setDuplicate(null);
    }

    try {
      const batch = await createBindings.mutateAsync(
        buildBindingsRequest({ textbookId: textbook.id as number, academicYearId: yearId, period, classIds }),
      );
      const summary = describeBatch(batch);
      if (summary.tone === 'success') toast.success(summary.text);
      else toast.info(summary.text);
      onSaved({ yearId, period, subjectId: effectiveSubjectId, classIds });
      onClose();
    } catch (error) {
      const reason = messageOf(error, 'Не удалось назначить учебник');
      setFormError(existing ? reason : `Учебник загружен в библиотеку, но не назначен: ${reason}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={existing ? 'Использовать существующий учебник' : 'Добавить учебник'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={checking}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {existing ? (
          <Field label="Учебник" required>
            <TextInput value={existing.title ?? ''} readOnly aria-readonly="true" />
          </Field>
        ) : (
          <>
            <Field label="Название" required error={shown(errors.title)}>
              <TextInput
                value={title}
                maxLength={TITLE_MAX}
                placeholder="Например, Spotlight 6. Student's Book"
                error={submitted && errors.title != null}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>

            <Field
              label="Файл"
              required
              error={fileProblem ?? shown(errors.file)}
              hint={checking ? 'Проверяем, нет ли такого файла в библиотеке…' : undefined}
            >
              <FileDropzone
                file={file}
                onChange={(next) => void changeFile(next)}
                accept={TEXTBOOK_ACCEPT}
                formatsLabel="PDF, DOCX · до 100 МБ"
                disabled={saving}
                error={fileProblem != null || (submitted && errors.file != null)}
              />
            </Field>

            {duplicate && (
              <NoticeBar tone="warning" icon={<AlertTriangle className="mt-px size-4 text-brand-500" />}>
                <p>Такой файл уже есть в библиотеке: «{duplicate.title}».</p>
                <button
                  type="button"
                  onClick={switchToExisting}
                  className="mt-1.5 font-medium text-navy-700 underline transition hover:text-navy-800"
                >
                  Использовать существующий вместо загрузки
                </button>
              </NoticeBar>
            )}
          </>
        )}

        <Field label="Класс(ы)" required error={shown(errors.classes)}>
          <MultiSelect
            aria-label="Класс(ы)"
            options={classes}
            value={classIds.map(String)}
            onChange={(next) => setClassIds(next.map(Number))}
            placeholder="Выберите классы"
            emptyLabel={
              effectiveSubjectId != null
                ? 'Вы не ведёте этот предмет ни в одном классе этого года'
                : 'В этом году у вас нет классов'
            }
            error={submitted && errors.classes != null}
          />
        </Field>

        <Field label="Предмет" required error={shown(errors.subject)}>
          <Select
            aria-label="Предмет"
            value={effectiveSubjectId != null ? String(effectiveSubjectId) : ''}
            disabled={existing != null}
            onChange={(event) => setSubjectId(event.target.value ? Number(event.target.value) : null)}
          >
            {!existing && <option value="">Выберите предмет</option>}
            {subjects.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Учебный год" required error={shown(errors.year)}>
          <Select aria-label="Учебный год" value={yearId != null ? String(yearId) : ''} onChange={(event) => changeYear(event.target.value)}>
            {(options?.years ?? []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Период/Четверть" required error={shown(errors.period)}>
          <Select aria-label="Период/Четверть" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {(year?.periods ?? []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
            {/* Пустой список периодов = все действующие периоды года (контракт §7): без этого
                годовой учебник назначают четыре раза. */}
            <option value={WHOLE_YEAR}>Весь учебный год</option>
          </Select>
        </Field>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </div>
    </Modal>
  );
}

/** Существующий учебник из ответа 409: сервер кладёт его в `details` целиком (контракт §3). */
function duplicateFrom(error: unknown): Textbook | null {
  if (!(error instanceof ApiError) || error.code !== TEXTBOOK_ERRORS.duplicate) return null;
  const details = error.details as Record<string, unknown> | undefined;
  const candidate = (details && 'textbook' in details ? details.textbook : details) as Textbook | undefined;
  return candidate && typeof candidate === 'object' && candidate.id != null ? candidate : null;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
