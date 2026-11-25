import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useToast } from '@/context/ToastContext';
import {
  useCreateAchievement,
  useReplaceAchievementFile,
  useUpdateAchievement,
} from '@/hooks/achievementQueries';
import { ApiError } from '@/lib/api';
import {
  ACHIEVEMENT_ACCEPT,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DESCRIPTION_MAX,
  ACHIEVEMENT_ORGANIZATION_MAX,
  ACHIEVEMENT_TITLE_MAX,
  EMPTY_FORM,
  formFromAchievement,
  hasErrors,
  requestFromForm,
  sizeLabel,
  titleFromFileName,
  validateForm,
  type AchievementForm,
} from '@/lib/achievementModel';
import type { AchievementCategory, TeacherAchievement } from '@/lib/achievementsApi';

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Добавление и правка достижения — одно окно.
 *
 * Новый документ сохраняется закрытым: доступ родителям — отдельное действие в списке, а не
 * поле формы (ТЗ §3). У существующего файл можно заменить; замена и поля — два запроса, файл
 * уходит первым. Каждый запрос сервер применяет целиком, поэтому упавший не трогает ни прежний
 * файл, ни доступ, а форма остаётся заполненной — «Повторить» отправляет то же самое.
 */
export function AchievementFormModal({
  open,
  achievement,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** `null` — добавление. */
  achievement: TeacherAchievement | null;
  onClose: () => void;
  onSaved: (saved: TeacherAchievement, created: boolean) => void;
}) {
  const toast = useToast();
  const create = useCreateAchievement();
  const update = useUpdateAchievement();
  const replaceFile = useReplaceAchievementFile();

  const [form, setForm] = useState<AchievementForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Файл уже заменён, а поля — нет: повтор не отправляет файл второй раз. */
  const [fileDone, setFileDone] = useState(false);

  const editing = achievement != null;

  useEffect(() => {
    if (!open) return;
    setForm(achievement ? formFromAchievement(achievement) : EMPTY_FORM);
    setFile(null);
    setSubmitted(false);
    setProgress(null);
    setFailure(null);
    setSaving(false);
    setFileDone(false);
  }, [open, achievement]);

  const errors = validateForm(form, file, { fileRequired: !editing, today: todayIso() });
  const shown = (message: string | null) => (submitted && message ? message : undefined);

  function patch(next: Partial<AchievementForm>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function chooseFile(next: File | null) {
    setFile(next);
    setFileDone(false);
    setFailure(null);
    // Название подставляется из имени файла, только пока учитель его не ввёл.
    if (next && !form.title.trim()) patch({ title: titleFromFileName(next.name).slice(0, ACHIEVEMENT_TITLE_MAX) });
  }

  async function save() {
    setSubmitted(true);
    if (hasErrors(errors)) return;
    setSaving(true);
    setFailure(null);
    const fields = requestFromForm(form);
    // Состояние `fileDone` в этом замыкании ещё старое — отметка этой попытки держится здесь.
    let fileReplaced = fileDone;
    try {
      if (!editing) {
        setProgress(0);
        const saved = await create.mutateAsync({ file: file as File, fields, onProgress: setProgress });
        toast.success('Документ сохранён. Родители его не видят, пока вы не откроете доступ.', 'Достижение добавлено');
        onSaved(saved, true);
        return;
      }
      const id = achievement.id as number;
      let saved: TeacherAchievement = achievement;
      if (file && !fileDone) {
        setProgress(0);
        saved = await replaceFile.mutateAsync({ id, file, onProgress: setProgress });
        fileReplaced = true;
        setFileDone(true);
      }
      if (fieldsChanged(achievement, form)) {
        saved = await update.mutateAsync({ id, fields });
      }
      toast.success('Изменения сохранены');
      onSaved(saved, false);
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : 'Не удалось сохранить. Попробуйте ещё раз.';
      setFailure(editing && fileReplaced ? `Файл заменён, но поля не сохранены: ${reason}` : reason);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const uploading = progress != null;

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={editing ? 'Изменить достижение' : 'Добавить достижение'}
      subtitle={editing ? undefined : 'Новый документ виден только вам. Доступ родителям открывается в списке.'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            {failure ? 'Повторить' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label={editing ? 'Заменить PDF' : 'PDF-файл'}
          required={!editing}
          error={shown(errors.file) ?? (file ? errors.file ?? undefined : undefined)}
          hint={editing && !file && achievement?.fileName
            ? `Сейчас: ${achievement.fileName}${achievement.sizeBytes ? ` · ${sizeLabel(achievement.sizeBytes)}` : ''}`
            : undefined}
        >
          <FileDropzone
            file={file}
            onChange={chooseFile}
            accept={ACHIEVEMENT_ACCEPT}
            formatsLabel="PDF · до 50 МБ"
            disabled={saving}
            error={(file != null && errors.file != null) || (submitted && errors.file != null)}
          />
        </Field>

        {uploading && (
          <ProgressBar value={Math.round((progress ?? 0) * 100)} max={100} label="Загрузка файла" tone="navy" />
        )}

        <Field label="Название" required error={shown(errors.title)}>
          <TextInput
            value={form.title}
            maxLength={ACHIEVEMENT_TITLE_MAX}
            placeholder="Например, Диплом победителя конкурса «Учитель года»"
            error={submitted && errors.title != null}
            disabled={saving}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Категория">
            <Select
              aria-label="Категория"
              value={form.category}
              disabled={saving}
              onChange={(event) => patch({ category: event.target.value as AchievementCategory | '' })}
            >
              <option value="">Без категории</option>
              {ACHIEVEMENT_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата получения" error={shown(errors.receivedOn)}>
            <TextInput
              type="date"
              value={form.receivedOn}
              max={todayIso()}
              disabled={saving}
              error={submitted && errors.receivedOn != null}
              onChange={(event) => patch({ receivedOn: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Организация">
          <TextInput
            value={form.organization}
            maxLength={ACHIEVEMENT_ORGANIZATION_MAX}
            placeholder="Кто выдал документ"
            disabled={saving}
            onChange={(event) => patch({ organization: event.target.value })}
          />
        </Field>

        <Field label="Описание">
          <TextArea
            value={form.description}
            maxLength={ACHIEVEMENT_DESCRIPTION_MAX}
            rows={3}
            disabled={saving}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>

        {failure && (
          <p role="alert" className="text-sm text-red-600">
            {failure}
          </p>
        )}
      </div>
    </Modal>
  );
}

function fieldsChanged(achievement: TeacherAchievement, form: AchievementForm): boolean {
  const before = formFromAchievement(achievement);
  return (Object.keys(before) as Array<keyof AchievementForm>).some(
    (key) => before[key].trim() !== form[key].trim(),
  );
}
