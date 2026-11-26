import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Eye, KeyRound } from 'lucide-react';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useRevokeStudyAccessGrant, useTeacherStudyAccess } from '@/hooks/queries';
import { cx } from '@/lib/format';
import type { StudyAccessGrant } from '@/lib/studyAccessApi';
import {
  SECTION_LABELS,
  STATE_LABELS,
  dotDate,
  remainingLabel,
  revokeMessage,
  scopeLabel,
  sortedSections,
  validityLabel,
} from '@/lib/studyAccessModel';
import { ProfileCard, ProfileLinkAction } from '../ProfileChrome';
import { StudyAccessGrantDrawer, type GrantDrawerMode } from './StudyAccessGrantDrawer';

/**
 * Блок «Дополнительные права доступа» карточки учителя (Figma `phyztex` А1, А6–А8, А11–А13).
 *
 * Строка — одно независимое право со своим годом, областью и сроком. Действующие сверху, с
 * меню «Изменить / Отозвать»; истёкшие и отозванные — сворачиваемой группой с «Выдать снова».
 * Состояние, остаток срока и то, что сохранится после отзыва, приходят с сервера: блок их
 * только называет.
 */
export function TeacherStudyAccessCard({
  teacherProfileId,
  teacherName,
  canGrant,
}: {
  teacherProfileId: number;
  teacherName: string;
  /** Права выдаются только действующему учителю (аккаунт «Активен») — иначе сервер ответит 409. */
  canGrant: boolean;
}) {
  const toast = useToast();
  const query = useTeacherStudyAccess(teacherProfileId);
  const revoke = useRevokeStudyAccessGrant();
  const [drawer, setDrawer] = useState<{ mode: GrantDrawerMode; session: number } | null>(null);
  const [revoking, setRevoking] = useState<StudyAccessGrant | null>(null);
  const [endedOpen, setEndedOpen] = useState<boolean | null>(null);

  const active = query.data?.active ?? [];
  const ended = query.data?.ended ?? [];
  const showEnded = endedOpen ?? active.length === 0;
  const openDrawer = (mode: GrantDrawerMode) => setDrawer({ mode, session: Date.now() });

  async function confirmRevoke() {
    if (!revoking?.id) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success('Основная роль и классы учителя не изменились', 'Доступ отозван');
      // Отозванная запись не исчезает, а уходит в историю — её и показываем (А12).
      setEndedOpen(true);
      setRevoking(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отозвать доступ');
    }
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold text-ink">Дополнительные права доступа</h2>
        <Badge appearance="tag" tone="gray" size="sm" icon={<Eye className="size-3" aria-hidden />}>Только просмотр</Badge>
      </div>
      {canGrant && (active.length > 0 || ended.length > 0) && (
        <ProfileLinkAction onClick={() => openDrawer({ kind: 'create' })}>+ Предоставить доступ</ProfileLinkAction>
      )}
    </div>
  );

  let content;
  if (query.isPending) {
    content = <LoadingBlock label="Загружаем права…" />;
  } else if (query.isError) {
    content = (
      <ErrorBlock
        message={query.error instanceof Error ? query.error.message : 'Не удалось загрузить права'}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (active.length === 0 && ended.length === 0) {
    content = (
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-subtle">
          <KeyRound className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-13 leading-relaxed text-muted">
          <strong className="font-semibold text-ink">Дополнительных прав нет.</strong> Можно открыть просмотр
          оценок, посещаемости или аналитики других классов — без редактирования.
        </p>
        {canGrant && <Button size="sm" onClick={() => openDrawer({ kind: 'create' })}>Предоставить доступ</Button>}
      </div>
    );
  } else {
    content = (
      <div role="table" aria-label="Дополнительные права доступа" className="flex flex-col pt-2">
        <div role="row" className="grid grid-cols-study-access-row pb-2.5 pt-0.5 text-11 font-semibold uppercase text-subtle">
          <span role="columnheader">Разделы</span>
          <span role="columnheader">Классы</span>
          <span role="columnheader">Срок и статус</span>
          <span role="columnheader"><span className="sr-only">Действия</span></span>
        </div>
        {active.length === 0 ? (
          <p className="border-t border-neutral-bg pb-3.5 pt-3 text-13 text-muted">
            Сейчас действующих прав нет — учитель видит только свои классы.
          </p>
        ) : active.map((grant) => (
          <GrantRow
            key={grant.id}
            grant={grant}
            action={(
              <ActionMenu
                label={`Действия с правом: ${scopeLabel(grant.scope)}`}
                placement="viewport"
                items={[
                  { label: 'Изменить', onSelect: () => openDrawer({ kind: 'edit', grant }) },
                  { label: 'Отозвать', danger: true, onSelect: () => setRevoking(grant) },
                ]}
              />
            )}
          />
        ))}
        {ended.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showEnded}
              onClick={() => setEndedOpen(!showEnded)}
              className="flex items-center gap-1.5 border-t border-neutral-bg pb-2 pt-3 text-left text-13 font-semibold text-muted transition hover:text-ink"
            >
              {showEnded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
              Истёкшие и отозванные · {ended.length}
            </button>
            {showEnded && ended.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                muted
                action={canGrant ? (
                  <ProfileLinkAction onClick={() => openDrawer({ kind: 'reissue', grant })}>Выдать снова</ProfileLinkAction>
                ) : null}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  const message = revoking ? revokeMessage(revoking, query.data?.teacher?.fullName ?? teacherName) : null;

  return (
    <ProfileCard className="flex flex-col gap-4">
      {header}
      {content}
      {drawer && (
        <StudyAccessGrantDrawer
          key={drawer.session}
          open
          onClose={() => setDrawer(null)}
          teacherProfileId={teacherProfileId}
          teacherName={query.data?.teacher?.fullName ?? teacherName}
          mode={drawer.mode}
        />
      )}
      <ConfirmDialog
        open={revoking != null}
        onClose={() => { if (!revoke.isPending) setRevoking(null); }}
        onConfirm={() => void confirmRevoke()}
        loading={revoke.isPending}
        danger
        title="Отозвать доступ?"
        confirmLabel="Отозвать"
        message={message && (
          <>
            {message.lead}
            <strong className="font-bold">{message.subject}</strong>
            {message.tail}
          </>
        )}
      />
    </ProfileCard>
  );
}

function GrantRow({ grant, muted = false, action }: { grant: StudyAccessGrant; muted?: boolean; action: ReactNode }) {
  const remaining = muted ? null : remainingLabel(grant.daysLeft);
  return (
    <div role="row" className="grid grid-cols-study-access-row items-center border-t border-neutral-bg py-3">
      <div role="cell" className="flex flex-wrap gap-1.5 pr-4">
        {sortedSections(grant.sections).map((section) => (
          <Badge key={section} appearance="tag" tone={muted ? 'gray' : 'navy'} size="md">{SECTION_LABELS[section]}</Badge>
        ))}
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-0.5 pr-4">
        <span className={cx('text-13 font-semibold leading-normal', muted ? 'text-muted' : 'text-ink')}>{scopeLabel(grant.scope)}</span>
        <span className="text-xs text-subtle">{grant.academicYear?.name}</span>
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-0.5 pr-4">
        <span className={cx('text-13 font-semibold leading-normal', muted ? 'text-muted' : 'text-ink')}>{validityLabel(grant.validUntil)}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs leading-4">
          <span aria-hidden className={cx('size-1.5 rounded-full', muted ? 'bg-slate-400' : 'bg-green-500')} />
          <span className={cx('font-semibold', muted ? 'text-muted' : 'text-green-700')}>{grant.state ? STATE_LABELS[grant.state] : '—'}</span>
          {remaining && <span className="text-subtle">· {remaining}</span>}
          {muted && grant.state === 'REVOKED' && grant.endedOn && <span className="text-subtle">· {dotDate(grant.endedOn)}</span>}
        </span>
      </div>
      <div role="cell" className="flex justify-end">{action}</div>
    </div>
  );
}
