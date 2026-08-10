import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { useSaveAnnouncement } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Announcement } from '@/lib/announcementsApi';
import { applicantGradeOptions } from './applicantFormHelpers';
import {
  EMPTY_ANNOUNCEMENT_FORM,
  toAnnouncementRequest,
  toDateTimeLocal,
  validateAnnouncementForm,
  type AnnouncementFormState,
} from './announcementFormHelpers';

/**
 * Форма создания и редактирования анонса (ТЗ §3.2).
 *
 * <p>Обязательны только название и класс — остальное администратор заполняет
 * по мере появления информации, а незаполненное просто не попадает в публичную
 * карточку. Поэтому в форме нет «обязательных» звёздочек там, где их нет в ТЗ.
 *
 * <p>Класс берётся из того же справочника, что и у поступающего
 * ({@link applicantGradeOptions}): анонс подбирается к поступающему точным
 * сравнением строки, и разъехавшиеся списки означали бы анонсы, которые никто
 * не найдёт.
 */
export function AnnouncementFormModal({
  open,
  onClose,
  announcement,
}: {
  open: boolean;
  onClose: () => void;
  announcement: Announcement | null;
}) {
  const isEdit = Boolean(announcement);
  const save = useSaveAnnouncement();
  const toast = useToast();

  const [form, setForm] = useState<AnnouncementFormState>(EMPTY_ANNOUNCEMENT_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      announcement
        ? {
            title: announcement.title ?? '',
            grade: announcement.grade ?? '',
            summary: announcement.summary ?? '',
            eventAt: toDateTimeLocal(announcement.eventAt),
            location: announcement.location ?? '',
            preparation: announcement.preparation ?? '',
            formatInfo: announcement.formatInfo ?? '',
            bringWithYou: announcement.bringWithYou ?? '',
            recommendations: announcement.recommendations ?? '',
          }
        : EMPTY_ANNOUNCEMENT_FORM,
    );
    setError(null);
  }, [open, announcement]);

  const gradeOptions = useMemo(
    () => applicantGradeOptions(announcement?.grade),
    [announcement],
  );

  // Уже опубликованный анонс правится «на месте» — отдельной кнопки публикации не нужно.
  const isPublished = announcement?.status === 'PUBLISHED';
  // «Сохранить черновик» уместно только там, где результат действительно черновик:
  // у скрытого анонса статус не меняется, и называть сохранение черновиком — врать.
  const isDraft = !isEdit || announcement?.status === 'DRAFT';

  function set<K extends keyof AnnouncementFormState>(key: K, value: AnnouncementFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Кнопки футера живут вне <form>, поэтому сюда приходит и submit-, и click-событие.
  async function submit(e: SyntheticEvent, publish: boolean) {
    e.preventDefault();
    const validationError = validateAnnouncementForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      const saved = await save.mutateAsync({
        id: announcement?.id,
        body: toAnnouncementRequest(form),
        publish,
      });
      toast.success(
        publish && saved.status === 'PUBLISHED'
          ? 'Анонс опубликован'
          : isEdit
            ? 'Изменения сохранены'
            : 'Черновик сохранён',
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить анонс');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Редактирование анонса' : 'Новый анонс'}
      subtitle="Заполните то, что уже известно. Пустые поля не попадут в публичную карточку."
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant={isPublished ? 'primary' : 'secondary'}
            onClick={(e) => void submit(e, false)}
            loading={save.isPending}
          >
            {isDraft ? 'Сохранить черновик' : 'Сохранить'}
          </Button>
          {!isPublished && (
            <Button onClick={(e) => void submit(e, true)} loading={save.isPending}>
              Сохранить и опубликовать
            </Button>
          )}
        </div>
      }
    >
      <form onSubmit={(e) => void submit(e, false)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название анонса" required>
            <TextInput
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Вступительное тестирование в 7 класс"
              maxLength={200}
              required
            />
          </Field>
          <Field label="Класс" required hint="Класс, для которого предназначен анонс">
            <Select value={form.grade} onChange={(e) => set('grade', e.target.value)} required>
              <option value="">Выберите класс</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Краткое описание">
          <TextArea
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder="О чём этот анонс в двух предложениях"
            maxLength={1000}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата и время проведения" hint="Время школы">
            <TextInput
              type="datetime-local"
              value={form.eventAt}
              onChange={(e) => set('eventAt', e.target.value)}
            />
          </Field>
          <Field label="Место проведения">
            <TextInput
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Корпус А, кабинет 305"
              maxLength={300}
            />
          </Field>
        </div>

        <Field label="Предметы и темы для подготовки">
          <TextArea
            value={form.preparation}
            onChange={(e) => set('preparation', e.target.value)}
            placeholder={'Математика: дроби, уравнения\nФизика: механика'}
            maxLength={4000}
          />
        </Field>

        <Field label="Формат и продолжительность">
          <TextArea
            value={form.formatInfo}
            onChange={(e) => set('formatInfo', e.target.value)}
            placeholder="60 минут, 20 заданий с выбором ответа"
            maxLength={2000}
          />
        </Field>

        <Field label="Что взять с собой">
          <TextArea
            value={form.bringWithYou}
            onChange={(e) => set('bringWithYou', e.target.value)}
            placeholder="Паспорт или свидетельство о рождении, ручка"
            maxLength={2000}
          />
        </Field>

        <Field label="Рекомендации и комментарий школы">
          <TextArea
            value={form.recommendations}
            onChange={(e) => set('recommendations', e.target.value)}
            maxLength={4000}
          />
        </Field>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}

        <p className="rounded-xl bg-info-bg px-4 py-3 text-sm text-slate-600">
          Предупреждение об античите добавляется в каждый опубликованный анонс
          автоматически — заполнять его не нужно.
        </p>
      </form>
    </Modal>
  );
}
