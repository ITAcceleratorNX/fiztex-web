import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { cx } from '@/lib/format';
import type { AcademicPeriod, SchoolClass } from '@/platform/types';
import type { ConstructorContextGroupSet } from '@/platform/services/schedules';
import { subgroupsApi } from '@/lib/schedule2bApi';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

export type CopyScheduleFormValues = {
  targetAcademicPeriodId: number;
  targetClassId?: number;
  bellTemplateId?: number;
  overwriteExistingDraft: boolean;
  subgroupMapping?: Record<number, number>;
};

/**
 * Состояния копирования по макетам:
 * 'source'       — 2015:13828, шаг 1 из 2
 * 'target'       — 2015:14239, шаг 2 из 2
 * 'conflict'     — 2015:14646, расписание уже существует
 * 'incompatible' — 2015:15040, шаблон звонков не совместим
 */
export type CopyStage = 'source' | 'target' | 'conflict' | 'incompatible';

/** Поле формы: метка 13px SemiBold + бокс с рамкой (2015:13833). */
const FIELD_LABEL = 'text-13 font-semibold text-muted';
const FIELD_BOX =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink';

export function CopyScheduleModal({
  open,
  stage = 'source',
  onStageChange,
  onClose,
  onSubmit,
  pending,
  periods,
  classes,
  templates,
  sourceClassId,
  sourceGroupSets,
  sourceYearName,
  sourcePeriodName,
  sourceClassName,
  incompatibleLessons = [],
}: {
  open: boolean;
  stage?: CopyStage;
  onStageChange: (stage: CopyStage) => void;
  onClose: () => void;
  onSubmit: (values: CopyScheduleFormValues) => Promise<void>;
  pending?: boolean;
  periods: AcademicPeriod[];
  classes: SchoolClass[];
  templates: Array<{ id: number; name: string }>;
  sourceClassId: number;
  sourceGroupSets: ConstructorContextGroupSet[];
  sourceYearName?: string;
  sourcePeriodName?: string;
  sourceClassName?: string;
  /** Уроки, которых нет в шаблоне звонков цели — для состояния 'incompatible'. */
  incompatibleLessons?: string[];
}) {
  const [targetPeriodId, setTargetPeriodId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [bellTemplateId, setBellTemplateId] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targetSubgroups, setTargetSubgroups] = useState<
    Array<{ id: number; name: string; groupSetName: string }>
  >([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceSubgroups = useMemo(
    () =>
      sourceGroupSets.flatMap((gs) =>
        (gs.subgroups ?? []).map((sg) => ({
          id: sg.id,
          name: sg.name,
          groupSetName: gs.name,
        })),
      ),
    [sourceGroupSets],
  );

  const crossClass = targetClassId !== '' && Number(targetClassId) !== sourceClassId;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTargetPeriodId(periods[0]?.id ?? '');
    setTargetClassId(String(sourceClassId));
    setBellTemplateId('');
    setMapping({});
    setTargetSubgroups([]);
  }, [open, periods, sourceClassId]);

  useEffect(() => {
    if (!open || !crossClass || !targetClassId) {
      setTargetSubgroups([]);
      return;
    }
    let cancelled = false;
    setLoadingTargets(true);
    void subgroupsApi
      .listGroupSets({ classId: Number(targetClassId), status: 'ACTIVE' })
      .then(async (sets) => {
        const details = await Promise.all(sets.map((gs) => subgroupsApi.getGroupSet(gs.id)));
        if (cancelled) return;
        setTargetSubgroups(
          details.flatMap((agg) =>
            (agg.subgroups ?? []).map((sg) => ({
              id: sg.id,
              name: sg.name,
              groupSetName: agg.groupSet.name,
            })),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setTargetSubgroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTargets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, crossClass, targetClassId]);

  async function runCopy(overwrite: boolean) {
    if (!targetPeriodId) {
      setError('Выберите целевой период');
      return;
    }
    let subgroupMapping: Record<number, number> | undefined;
    if (crossClass && sourceSubgroups.length > 0) {
      const map: Record<number, number> = {};
      for (const src of sourceSubgroups) {
        const target = mapping[String(src.id)];
        if (!target) {
          setError(`Укажите соответствие для подгруппы «${src.name}»`);
          return;
        }
        map[src.id] = Number(target);
      }
      subgroupMapping = map;
    }
    setError(null);
    await onSubmit({
      targetAcademicPeriodId: Number(targetPeriodId),
      targetClassId: targetClassId ? Number(targetClassId) : undefined,
      bellTemplateId: bellTemplateId ? Number(bellTemplateId) : undefined,
      overwriteExistingDraft: overwrite,
      subgroupMapping,
    });
  }

  // 2015:14646 — расписание уже существует
  if (stage === 'conflict') {
    return (
      <ModalCard
        open={open}
        onClose={onClose}
        labelledBy="copy-title"
        className="max-w-[480px] gap-5 p-6"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 id="copy-title" className="text-lg font-bold text-ink">
            Расписание уже существует
          </h2>
          <p className="text-13 leading-[18px] text-muted">
            В расписании {targetClassName(classes, targetClassId)} на выбранный период уже есть
            уроки.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-3">
          <button
            type="button"
            onClick={() => void runCopy(true)}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-[11px] text-13 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Заменить
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-line px-4 py-[11px] text-13 font-semibold text-muted transition hover:bg-gray-50"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => onStageChange('target')}
            className="w-full px-4 py-2 text-xs font-semibold text-navy-700 underline"
          >
            Выбрать другой класс/период
          </button>
        </div>
      </ModalCard>
    );
  }

  // 2015:15040 — шаблон звонков не совместим
  if (stage === 'incompatible') {
    return (
      <ModalCard
        open={open}
        onClose={onClose}
        labelledBy="copy-title"
        className="max-w-[500px] gap-5 p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="copy-title" className="text-lg font-bold text-ink">
            Шаблон звонков не совместим
          </h2>
          <p className="text-13 leading-[18px] text-muted">
            Некоторые уроки из исходного расписания отсутствуют в шаблоне звонков целевого класса.
          </p>
        </div>
        <ul className="flex flex-col gap-1 rounded-lg border border-line bg-gray-50 p-3">
          {incompatibleLessons.map((text) => (
            <li key={text} className="flex items-center gap-2.5 py-2">
              <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-50 text-11 font-bold text-brand-500">
                !
              </span>
              <span className="text-13 font-medium text-ink">{text}</span>
            </li>
          ))}
        </ul>
        <ModalActions className="pt-2">
          <button
            type="button"
            onClick={() => onStageChange('target')}
            className="rounded-lg border border-line px-[18px] py-2.5 text-13 font-semibold text-muted transition hover:bg-gray-50"
          >
            Назад
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg bg-line px-[18px] py-2.5 text-13 font-semibold text-gray-400"
          >
            Скопировать
          </button>
        </ModalActions>
      </ModalCard>
    );
  }

  // 2015:13828 — шаг 1 из 2, источник
  if (stage === 'source') {
    return (
      <ModalCard
        open={open}
        onClose={onClose}
        labelledBy="copy-title"
        className="max-w-[480px] gap-6 p-6"
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase text-gray-400">Шаг 1 из 2</p>
          <h2 id="copy-title" className="text-lg font-bold text-ink">
            Копировать расписание — Источник
          </h2>
        </div>

        {/* Источник задан открытым расписанием, поэтому поля только показывают его. */}
        <div className="flex flex-col gap-4">
          <ReadonlyField label="Учебный год" value={sourceYearName ?? '—'} />
          <ReadonlyField label="Период" value={sourcePeriodName ?? '—'} />
          <ReadonlyField label="Класс" value={sourceClassName ?? '—'} />
        </div>

        <ModalActions>
          <button type="button" onClick={onClose} className={cx(MODAL_SECONDARY, 'text-ink')}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onStageChange('target')}
            className={cx(MODAL_PRIMARY, 'bg-navy-700 hover:bg-navy-800')}
          >
            Далее
          </button>
        </ModalActions>
      </ModalCard>
    );
  }

  // 2015:14239 — шаг 2 из 2, назначение
  return (
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="copy-title"
      className="max-w-[480px] gap-5 p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase text-blue-500">Шаг 2 из 2</p>
        <h2 id="copy-title" className="text-lg font-bold text-ink">
          Копировать расписание — Назначение
        </h2>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Класс</span>
          <Select
            value={targetClassId}
            onChange={(e) => setTargetClassId(e.target.value)}
            className={FIELD_BOX}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Период</span>
          <Select
            value={targetPeriodId}
            onChange={(e) => setTargetPeriodId(e.target.value)}
            className={FIELD_BOX}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Ниже — то, чего в макете нет, но без чего не работает API копирования. */}
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Шаблон звонков</span>
          <Select
            value={bellTemplateId}
            onChange={(e) => setBellTemplateId(e.target.value)}
            className={FIELD_BOX}
          >
            <option value="">Как у цели / по умолчанию</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        {crossClass && sourceSubgroups.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <p className="text-13 font-semibold text-ink">Соответствие подгрупп</p>
            {loadingTargets && (
              <p className="text-11 text-muted">Загрузка подгрупп целевого класса…</p>
            )}
            {sourceSubgroups.map((src) => (
              <div key={src.id} className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL}>
                  {src.groupSetName}: {src.name}
                </span>
                <Select
                  value={mapping[String(src.id)] ?? ''}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [String(src.id)]: e.target.value }))
                  }
                  className={FIELD_BOX}
                >
                  <option value="">Выберите</option>
                  {targetSubgroups.map((tg) => (
                    <option key={tg.id} value={tg.id}>
                      {tg.groupSetName}: {tg.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-13 text-red-600">{error}</p>}
      </div>

      <ModalActions className="pt-2">
        <button
          type="button"
          onClick={() => onStageChange('source')}
          className="rounded-lg border border-line px-[18px] py-2.5 text-13 font-semibold text-muted transition hover:bg-gray-50"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={() => void runCopy(false)}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-[18px] py-2.5 text-13 font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-gray-400"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Скопировать
        </button>
      </ModalActions>
    </ModalCard>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <p className={cx(FIELD_BOX, 'bg-gray-50')}>{value}</p>
    </div>
  );
}

function targetClassName(classes: SchoolClass[], id: string): string {
  return classes.find((c) => c.id === id)?.name ?? 'класса';
}
