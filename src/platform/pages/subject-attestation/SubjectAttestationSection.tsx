import { useState } from 'react';
import { History, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { useToast } from '@/context/ToastContext';
import { useAttestationSettings, useCancelAttestationSetting } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { AttestationSetting } from '@/lib/attestationSettingsApi';
import {
  classesCaption,
  DEFAULT_RULE_LINE,
  ruleLine,
  scopeTitle,
  sortSettings,
  STATE_BADGES,
  termCaption,
} from '@/lib/subjectAttestationModel';
import { useAcademicPeriods } from '@/platform/hooks/useSubgroups';
import { AttestationHistoryModal } from './AttestationHistoryModal';

export interface AttestationYear {
  id: number;
  name: string;
}

/**
 * Блок «Итоговая аттестация · год» в окне «Редактировать предмет» (макеты А2 2224:1694, А5
 * 2224:2443, А9 2224:3564): действующие, запланированные и прошлые версии с затронутыми классами.
 *
 * Действия строки — по состоянию версии от сервера: действующую без назначенного конца можно
 * «Изменить» (новая версия со следующего периода), запланированную — «Отменить». Ошибка загрузки
 * не подменяется умолчанием: экран не утверждает «по умолчанию», если не знает, так ли это.
 */
export function SubjectAttestationSection({
  subjectId,
  subjectName,
  years,
  yearId,
  onChangeYear,
  onAdd,
  onEdit,
}: {
  subjectId: number;
  subjectName: string;
  years: AttestationYear[];
  yearId: number;
  onChangeYear: (yearId: number) => void;
  onAdd: () => void;
  onEdit: (setting: AttestationSetting) => void;
}) {
  const toast = useToast();
  const settings = useAttestationSettings(yearId, subjectId);
  const periods = useAcademicPeriods(yearId);
  const cancel = useCancelAttestationSetting();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelling, setCancelling] = useState<AttestationSetting | null>(null);
  const year = years.find((item) => item.id === yearId);
  const rows = sortSettings(settings.data ?? []);
  const yearPeriods = (periods.data ?? []).filter((period) => period.status !== 'ARCHIVED');

  async function confirmCancel() {
    if (!cancelling?.id) return;
    try {
      await cancel.mutateAsync(cancelling.id);
      toast.success('Запланированная настройка отменена');
      setCancelling(null);
    } catch (failure) {
      toast.error(failure instanceof ApiError ? failure.message : 'Не удалось отменить настройку. Повторите попытку.');
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5" aria-label="Итоговая аттестация">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-15 font-bold text-ink">
          Итоговая аттестация ·
          {years.length > 1 ? (
            <span className="w-36">
              <Select aria-label="Учебный год настройки" value={String(yearId)}
                onChange={(event) => onChangeYear(Number(event.target.value))}>
                {years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </span>
          ) : <span>{year?.name}</span>}
        </h3>
        {!settings.isError && (
          <Button variant="ghost" size="sm" icon={<History className="size-4" />} onClick={() => setHistoryOpen(true)}
            disabled={settings.isPending}>
            История
          </Button>
        )}
      </div>

      {settings.isPending ? (
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" aria-busy="true" aria-label="Загрузка настроек аттестации" />
      ) : settings.isError ? (
        <StatusNotice tone="error">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>Не удалось загрузить настройки аттестации. Название и профиль формул можно менять.</span>
            <Button variant="secondary" size="sm" onClick={() => void settings.refetch()}>Повторить</Button>
          </span>
        </StatusNotice>
      ) : (
        <>
          {rows.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {rows.map((setting) => (
                <SettingRow key={setting.id} setting={setting} term={termCaption(setting, yearPeriods)}
                  onEdit={() => onEdit(setting)} onCancel={() => setCancelling(setting)} />
              ))}
            </ul>
          )}
          <p className="text-13 text-muted">
            {rows.length > 0 ? 'Остальные классы' : 'Все классы'} — по умолчанию: {DEFAULT_RULE_LINE}.
          </p>
          <div>
            <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={onAdd}>
              Добавить настройку
            </Button>
          </div>
        </>
      )}

      {historyOpen && (
        <AttestationHistoryModal yearId={yearId} subjectId={subjectId} subtitle={`${subjectName} · ${year?.name ?? ''}`}
          settings={settings.data ?? []} onClose={() => setHistoryOpen(false)} />
      )}
      <ConfirmDialog
        open={cancelling != null}
        title="Отменить запланированную настройку?"
        message={cancelling ? `${scopeTitle(cancelling)}: ${ruleLine(cancelling)}, ${termCaption(cancelling)}. `
          + 'Если она сменяла действующую, та продолжит действовать без конца срока.' : ''}
        confirmLabel="Отменить настройку"
        cancelLabel="Не отменять"
        danger
        loading={cancel.isPending}
        onConfirm={() => void confirmCancel()}
        onClose={() => { if (!cancel.isPending) setCancelling(null); }}
      />
    </section>
  );
}

function SettingRow({ setting, term, onEdit, onCancel }: {
  setting: AttestationSetting; term: string; onEdit: () => void; onCancel: () => void;
}) {
  const badge = STATE_BADGES[setting.state ?? 'ACTIVE'];
  const editable = setting.state === 'ACTIVE' && !setting.effectiveTo;
  const scheduled = setting.state === 'SCHEDULED';
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 ${scheduled ? 'bg-slate-50' : ''}`}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-ink">{scopeTitle(setting)}</span>
        {setting.parallel && <span className="truncate text-13 text-muted">{classesCaption(setting.classNames)}</span>}
      </span>
      <span className="text-sm text-slate-700">{ruleLine(setting)}</span>
      <span className="flex min-w-0 flex-col items-start gap-1">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <span className="text-11 text-muted">{term}</span>
      </span>
      <span className="flex w-24 justify-end">
        {editable && <Button variant="ghost" size="sm" onClick={onEdit}>Изменить</Button>}
        {scheduled && <Button variant="ghost" size="sm" onClick={onCancel}>Отменить</Button>}
      </span>
    </li>
  );
}
