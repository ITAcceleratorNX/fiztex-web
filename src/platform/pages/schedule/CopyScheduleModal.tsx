import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { AcademicPeriod, SchoolClass } from '@/platform/types';
import type { ConstructorContextGroupSet } from '@/platform/services/schedules';
import { subgroupsApi } from '@/lib/schedule2bApi';

export type CopyScheduleFormValues = {
  targetAcademicPeriodId: number;
  targetClassId?: number;
  bellTemplateId?: number;
  overwriteExistingDraft: boolean;
  subgroupMapping?: Record<number, number>;
};

export function CopyScheduleModal({
  open,
  onClose,
  onSubmit,
  pending,
  periods,
  classes,
  templates,
  sourceClassId,
  sourceGroupSets,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CopyScheduleFormValues) => Promise<void>;
  pending?: boolean;
  periods: AcademicPeriod[];
  classes: SchoolClass[];
  templates: Array<{ id: number; name: string }>;
  sourceClassId: number;
  sourceGroupSets: ConstructorContextGroupSet[];
}) {
  const [targetPeriodId, setTargetPeriodId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [bellTemplateId, setBellTemplateId] = useState('');
  const [overwrite, setOverwrite] = useState(false);
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

  const crossClass =
    targetClassId !== '' && Number(targetClassId) !== sourceClassId;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTargetPeriodId(periods[0]?.id ?? '');
    setTargetClassId(String(sourceClassId));
    setBellTemplateId('');
    setOverwrite(false);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Копировать расписание"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            Копировать
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Целевой период" required>
          <Select
            value={targetPeriodId}
            onChange={(e) => setTargetPeriodId(e.target.value)}
            required
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Целевой класс" required>
          <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Шаблон звонков">
          <Select value={bellTemplateId} onChange={(e) => setBellTemplateId(e.target.value)}>
            <option value="">Как у цели / по умолчанию</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          Перезаписать существующий черновик цели
        </label>
        {crossClass && sourceSubgroups.length > 0 && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-800">Соответствие подгрупп</p>
            {loadingTargets && (
              <p className="text-xs text-slate-500">Загрузка подгрупп целевого класса…</p>
            )}
            {sourceSubgroups.map((src) => (
              <Field key={src.id} label={`${src.groupSetName}: ${src.name}`} required>
                <Select
                  value={mapping[String(src.id)] ?? ''}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [String(src.id)]: e.target.value }))
                  }
                  required
                >
                  <option value="">Выберите</option>
                  {targetSubgroups.map((tg) => (
                    <option key={tg.id} value={tg.id}>
                      {tg.groupSetName}: {tg.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
