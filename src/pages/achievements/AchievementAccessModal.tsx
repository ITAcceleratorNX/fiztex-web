import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { RadioCardGroup, type RadioCardOption } from '@/components/ui/RadioCardGroup';
import { useToast } from '@/context/ToastContext';
import { useAchievementAudienceOptions, useUpdateAchievementVisibility } from '@/hooks/achievementQueries';
import { ApiError } from '@/lib/api';
import {
  draftFromAchievement,
  inactiveSelectedClasses,
  visibilityDraftError,
  type VisibilityDraft,
} from '@/lib/achievementModel';
import type { AchievementVisibility, TeacherAchievement } from '@/lib/achievementsApi';

const OPTIONS: ReadonlyArray<RadioCardOption<AchievementVisibility>> = [
  { value: 'PRIVATE', title: 'Только я', description: 'Документ виден только вам. Родители его не видят.' },
  {
    value: 'ALL_CLASSES',
    title: 'Все мои классы',
    description: 'Родители всех классов, в которых вы сейчас преподаёте. Новый класс увидит документ сам.',
  },
  { value: 'SELECTED_CLASSES', title: 'Выбранные классы', description: 'Только родители отмеченных классов.' },
];

/**
 * Доступ родителей к одному документу (ТЗ §3). Настройка у каждого документа своя.
 *
 * Список классов — действующие назначения учителя, и сервер проверяет выбор по ним же: класс,
 * который учитель перестал вести, выбрать нельзя, а уже выбранный показан отдельной строкой —
 * родители этого класса документ больше не видят.
 */
export function AchievementAccessModal({
  achievement,
  onClose,
}: {
  achievement: TeacherAchievement | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const audience = useAchievementAudienceOptions(achievement != null);
  const save = useUpdateAchievementVisibility();
  const [draft, setDraft] = useState<VisibilityDraft>({ visibility: 'PRIVATE', classIds: [] });
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!achievement) return;
    setDraft(draftFromAchievement(achievement));
    setSubmitted(false);
    setFailure(null);
  }, [achievement]);

  const classes = audience.data?.classes ?? [];
  const error = audience.data ? visibilityDraftError(draft, classes.length) : null;
  const former = achievement ? inactiveSelectedClasses(achievement) : [];

  async function submit() {
    if (!achievement?.id) return;
    setSubmitted(true);
    if (error) return;
    setFailure(null);
    try {
      await save.mutateAsync({
        id: achievement.id,
        body: {
          visibility: draft.visibility,
          classIds: draft.visibility === 'SELECTED_CLASSES' ? draft.classIds : undefined,
        },
      });
      toast.success(draft.visibility === 'PRIVATE' ? 'Доступ родителям закрыт' : 'Доступ родителям открыт');
      onClose();
    } catch (cause) {
      // Отказ не меняет документ: прежний доступ действует, выбор в окне остаётся для повтора.
      setFailure(cause instanceof ApiError ? cause.message : 'Не удалось сохранить доступ. Попробуйте ещё раз.');
      void audience.refetch();
    }
  }

  return (
    <Modal
      open={achievement != null}
      onClose={save.isPending ? () => undefined : onClose}
      title="Доступ родителям"
      subtitle={achievement?.title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button onClick={() => void submit()} loading={save.isPending} disabled={!audience.data}>
            {failure ? 'Повторить' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <RadioCardGroup
          ariaLabel="Кому виден документ"
          value={draft.visibility}
          options={OPTIONS}
          disabled={save.isPending}
          onChange={(visibility) => setDraft((current) => ({ ...current, visibility }))}
        />

        {draft.visibility === 'SELECTED_CLASSES' && (
          <Field label="Классы" required error={submitted ? error ?? undefined : undefined}>
            <MultiSelect
              aria-label="Классы"
              options={classes.map((item) => ({ value: String(item.id), label: item.name ?? '' }))}
              value={draft.classIds.map(String)}
              onChange={(next) => setDraft((current) => ({ ...current, classIds: next.map(Number) }))}
              placeholder={audience.isPending ? 'Загружаем классы…' : 'Выберите классы'}
              emptyLabel="Сейчас вы не преподаёте ни в одном классе"
              disabled={save.isPending || audience.isPending}
              error={submitted && error != null}
            />
          </Field>
        )}

        {draft.visibility === 'ALL_CLASSES' && classes.length > 0 && (
          <p className="text-13 text-slate-500">Сейчас: {classes.map((item) => item.name).join(', ')}</p>
        )}

        {draft.visibility !== 'SELECTED_CLASSES' && submitted && error && (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        )}

        {former.length > 0 && (
          <p className="text-13 text-amber-700">
            Вы больше не ведёте: {former.join(', ')}. Родители этих классов документ уже не видят.
          </p>
        )}

        {audience.isError && (
          <p role="alert" className="text-sm text-red-600">Не удалось загрузить ваши классы. Закройте окно и попробуйте снова.</p>
        )}
        {failure && <p role="alert" className="text-sm text-red-600">{failure}</p>}
      </div>
    </Modal>
  );
}
