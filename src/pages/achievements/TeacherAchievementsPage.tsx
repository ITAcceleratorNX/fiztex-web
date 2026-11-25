import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Award, Eye, FileText, Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { WorkspacePageHeader } from '@/components/ui/WorkspacePageHeader';
import { useToast } from '@/context/ToastContext';
import { useDeleteAchievement, useTeacherAchievements } from '@/hooks/achievementQueries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { sizeLabel, visibilitySummary } from '@/lib/achievementModel';
import { achievementsApi, type TeacherAchievement } from '@/lib/achievementsApi';
import { formatDate } from '@/lib/format';
import { openTextbookFile } from '@/lib/textbookFile';
import { AchievementAccessModal } from './AchievementAccessModal';
import { AchievementFormModal } from './AchievementFormModal';

export const ACHIEVEMENTS_PATH = '/workspace/achievements';

/** Старый адрес раздела рабочего пространства ведёт сюда — как у КТП. */
export function AchievementsSectionRedirect() {
  return <Navigate replace to={ACHIEVEMENTS_PATH} />;
}

type Editing = { achievement: TeacherAchievement | null } | null;

/**
 * «Достижения» рабочего пространства (в Figma — «Медали и грамоты»): свои PDF учителя и доступ
 * к ним родителям. Видимость считает сервер по действующим назначениям, поэтому строка
 * показывает `visibleToParents`, а не повторяет правило: документ, открытый классу, который
 * учитель больше не ведёт, честно подписан «Не видно никому».
 */
export function TeacherAchievementsPage() {
  useDocumentTitle('Достижения');
  const toast = useToast();
  const list = useTeacherAchievements();
  const remove = useDeleteAchievement();
  const [editing, setEditing] = useState<Editing>(null);
  const [access, setAccess] = useState<TeacherAchievement | null>(null);
  const [deleting, setDeleting] = useState<TeacherAchievement | null>(null);

  async function open(achievement: TeacherAchievement) {
    try {
      await openTextbookFile({
        load: () => achievementsApi.content(achievement.id as number),
        format: 'PDF',
        fileName: achievement.fileName ?? 'document.pdf',
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось открыть файл');
    }
  }

  async function confirmDelete() {
    if (!deleting?.id) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Достижение удалено. Родители больше его не видят.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось удалить достижение');
    } finally {
      setDeleting(null);
    }
  }

  const items = list.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeader
        section
        title="Достижения"
        backTo="/workspace"
        backLabel="К рабочему пространству"
        description="Дипломы, сертификаты и грамоты в PDF. Новый документ виден только вам — доступ родителям своих классов вы открываете сами."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ achievement: null })}>
            Добавить достижение
          </Button>
        }
      />

      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBlock message="Не удалось загрузить достижения." onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock
          icon={<Award className="size-6" />}
          title="Достижений пока нет"
          description="Загрузите диплом или сертификат в PDF — и решите, каким классам его показать."
          action={
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ achievement: null })}>
              Добавить достижение
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <AchievementRow
              key={item.id}
              achievement={item}
              onOpen={() => void open(item)}
              onEdit={() => setEditing({ achievement: item })}
              onAccess={() => setAccess(item)}
              onDelete={() => setDeleting(item)}
            />
          ))}
        </ul>
      )}

      <AchievementFormModal
        open={editing != null}
        achievement={editing?.achievement ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
      <AchievementAccessModal achievement={access} onClose={() => setAccess(null)} />
      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Удалить достижение?"
        message={
          <>
            «{deleting?.title}» исчезнет из раздела, а родители, которым он был открыт, больше не
            смогут его открыть. Вернуть документ нельзя — только загрузить заново.
          </>
        }
        confirmLabel="Удалить"
        danger
        loading={remove.isPending}
      />
    </div>
  );
}

function AchievementRow({
  achievement,
  onOpen,
  onEdit,
  onAccess,
  onDelete,
}: {
  achievement: TeacherAchievement;
  onOpen: () => void;
  onEdit: () => void;
  onAccess: () => void;
  onDelete: () => void;
}) {
  const visibility = visibilitySummary(achievement);
  const meta = [
    achievement.categoryLabel,
    achievement.receivedOn ? formatDate(achievement.receivedOn) : null,
    achievement.organization,
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
        <FileText className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="text-left text-15 font-semibold text-slate-900 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
        >
          {achievement.title}
        </button>
        {meta.length > 0 && <p className="mt-1 text-13 text-slate-500">{meta.join(' · ')}</p>}
        {achievement.description && (
          <p className="mt-1 line-clamp-2 text-13 text-slate-600">{achievement.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={visibility.tone}>
            {achievement.visibility === 'PRIVATE' ? (
              <Lock className="mr-1 inline size-3" aria-hidden="true" />
            ) : (
              <Users className="mr-1 inline size-3" aria-hidden="true" />
            )}
            {visibility.label}
          </Badge>
          {visibility.detail && <span className="text-13 text-slate-500">{visibility.detail}</span>}
          <span className="text-13 text-slate-400">
            {achievement.fileName}
            {achievement.sizeBytes ? ` · ${sizeLabel(achievement.sizeBytes)}` : ''}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={<Users className="size-4" />} onClick={onAccess}>
          Доступ
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Открыть PDF" title="Открыть PDF" onClick={onOpen}>
          <Eye className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Изменить" title="Изменить" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="danger-ghost" size="icon-sm" aria-label="Удалить" title="Удалить" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
