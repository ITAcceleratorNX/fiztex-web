import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, Inbox, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useEquipmentUnit,
  useResolveEquipmentProblem,
  useReturnEquipment,
  useWriteOffEquipmentUnit,
} from '@/hooks/queries';
import { formatDateTime } from '@/lib/format';
import { EquipmentProblemModal } from './EquipmentProblemModal';
import { EquipmentUnitFormModal } from './EquipmentUnitFormModal';
import {
  conflictHolderName,
  equipmentAction,
  equipmentProblemLabel,
  equipmentState,
  errorMessage,
  eventEmployee,
  type EquipmentUnit,
} from './equipmentModel';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="w-40 shrink-0 text-13 text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 text-13 text-slate-700">{children}</span>
    </div>
  );
}

/**
 * Карточка экземпляра — единственное место, где над ним совершают действия (ТЗ §7.2–§7.6).
 *
 * <p>Строка таблицы ведёт сюда, а не раскладывает кнопки по колонкам: действий шесть, они
 * зависят от состояния, и половина из них спрашивает подтверждение. Здесь же лента
 * событий — «что с этой вещью было» отвечается на том же экране, где её меняют.
 *
 * <p>Что разрешено, карточка не вычисляет: `issuable` и `transferable` приходят
 * посчитанными, и правило «выдачу запрещает только потеря» живёт на сервере в одном
 * экземпляре.
 */
export function EquipmentUnitCardModal({
  unitId,
  onClose,
  onIssue,
  onTransfer,
}: {
  unitId: number | null;
  onClose: () => void;
  onIssue: (unit: EquipmentUnit) => void;
  onTransfer: (unit: EquipmentUnit) => void;
}) {
  const toast = useToast();
  const card = useEquipmentUnit(unitId);
  const returnUnits = useReturnEquipment();
  const resolveProblem = useResolveEquipmentProblem();
  const writeOff = useWriteOffEquipmentUnit();

  const [problemOpen, setProblemOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  /** Держатель, о котором сообщил отказ: вещь выдали в другой сессии, пока карточка была открыта. */
  const [writeOffHolder, setWriteOffHolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setWriteOffHolder(null);
  }, [unitId]);

  const unit = card.data?.unit;
  const history = card.data?.history ?? [];
  const state = equipmentState(unit?.state);
  const problem = equipmentProblemLabel(unit?.problem);
  const pending = returnUnits.isPending || resolveProblem.isPending || writeOff.isPending;

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await action();
      toast.success(message);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function confirmWriteOff() {
    setError(null);
    try {
      await writeOff.mutateAsync({
        unitId: unit!.id!,
        // Подтверждаем ровно то, что видно на карточке: если вещь выдали в другой сессии,
        // сервер ответит отказом с держателем, а не закроет чужую выдачу молча (§11).
        body: { confirmIssued: unit!.state === 'ISSUED' || writeOffHolder != null },
      });
      toast.success('Экземпляр списан');
      setWriteOffOpen(false);
      setWriteOffHolder(null);
    } catch (err) {
      const holder = conflictHolderName(err);
      if (holder) {
        setWriteOffHolder(holder);
        return;
      }
      setWriteOffOpen(false);
      setError(errorMessage(err, 'Не удалось списать'));
    }
  }

  return (
    <>
      <Modal
        open={unitId != null}
        onClose={pending ? () => undefined : onClose}
        title={unit?.itemName ?? 'Экземпляр'}
        subtitle={unit?.inventoryNumber ? `Инвентарный № ${unit.inventoryNumber}` : undefined}
        size="lg"
        footer={
          unit && unit.state !== 'WRITTEN_OFF' ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setWriteOffOpen(true)}
                disabled={pending}
              >
                Списать
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => setEditOpen(true)}
                  disabled={pending}
                >
                  Изменить
                </Button>
                {unit.problem ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Check className="h-4 w-4" />}
                    onClick={() =>
                      run(
                        () => resolveProblem.mutateAsync({ unitId: unit.id!, body: {} }),
                        'Проблема снята',
                      )
                    }
                    disabled={pending}
                  >
                    Снять проблему
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<AlertTriangle className="h-4 w-4" />}
                    onClick={() => setProblemOpen(true)}
                    disabled={pending}
                  >
                    Отметить проблему
                  </Button>
                )}
                {unit.state === 'ISSUED' ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ArrowLeftRight className="h-4 w-4" />}
                      onClick={() => onTransfer(unit)}
                      disabled={pending || !unit.transferable}
                    >
                      Передать
                    </Button>
                    <Button
                      size="sm"
                      icon={<Inbox className="h-4 w-4" />}
                      onClick={() =>
                        run(
                          () => returnUnits.mutateAsync({ unitIds: [unit.id!] }),
                          'Экземпляр принят обратно',
                        )
                      }
                      disabled={pending}
                    >
                      Принять обратно
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    icon={<UserPlus className="h-4 w-4" />}
                    onClick={() => onIssue(unit)}
                    disabled={pending || !unit.issuable}
                  >
                    Выдать
                  </Button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {card.isPending ? (
          <LoadingBlock label="Загрузка экземпляра" />
        ) : card.isError || !unit ? (
          <ErrorBlock
            message={errorMessage(card.error, 'Не удалось загрузить экземпляр')}
            onRetry={() => void card.refetch()}
          />
        ) : (
          <div className="space-y-4">
            {error && <NoticeBar tone="warning">{error}</NoticeBar>}
            {unit.state === 'WRITTEN_OFF' && (
              <NoticeBar tone="warning">
                Списано {formatDateTime(unit.writtenOffAt)} — остаётся только история.
              </NoticeBar>
            )}
            {unit.state !== 'WRITTEN_OFF' && !unit.issuable && !unit.transferable && unit.problem && (
              <NoticeBar tone="warning">
                Экземпляр отмечен потерянным — выдать и передать его нельзя, пока проблема не
                снята.
              </NoticeBar>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={state.tone} dot>
                {state.label}
              </Badge>
              {problem && (
                <Badge tone="red" dot>
                  {problem}
                </Badge>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 px-4 py-1">
              <Row label="Позиция">{unit.itemName ?? '—'}</Row>
              <Row label="Инвентарный номер">{unit.inventoryNumber ?? '—'}</Row>
              <Row label="Серийный номер">{unit.serialNumber || '—'}</Row>
              {unit.state === 'ISSUED' && (
                <>
                  <Row label="У кого">
                    {unit.holder?.fullName ?? '—'}
                    {unit.holder?.active === false && (
                      <span className="ml-1.5 text-xs text-slate-400">(неактивен)</span>
                    )}
                  </Row>
                  <Row label="Выдано">{formatDateTime(unit.issuedAt)}</Row>
                  {unit.issueComment && <Row label="Комментарий">{unit.issueComment}</Row>}
                </>
              )}
              {unit.problem?.note && <Row label="О проблеме">{unit.problem.note}</Row>}
              <Row label="Примечание">{unit.note || '—'}</Row>
            </div>

            <div>
              <p className="label-base">История</p>
              <div className="rounded-xl border border-slate-200">
                {history.length === 0 ? (
                  <p className="px-4 py-5 text-13 text-slate-400">Событий пока нет</p>
                ) : (
                  history.map((event) => {
                    const action = equipmentAction(event.action);
                    return (
                      <div
                        key={event.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-2.5 last:border-b-0"
                      >
                        <Badge tone={action.tone}>{action.label}</Badge>
                        <span className="text-13 text-slate-600">{eventEmployee(event)}</span>
                        {event.comment && (
                          <span className="text-13 text-slate-400">· {event.comment}</span>
                        )}
                        <span className="ml-auto text-xs text-slate-400">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {unit && (
        <>
          <EquipmentProblemModal
            open={problemOpen}
            onClose={() => setProblemOpen(false)}
            unit={unit}
          />
          <EquipmentUnitFormModal open={editOpen} onClose={() => setEditOpen(false)} unit={unit} />
          <ConfirmDialog
            open={writeOffOpen}
            onClose={() => {
              setWriteOffOpen(false);
              setWriteOffHolder(null);
            }}
            onConfirm={confirmWriteOff}
            title="Списать экземпляр?"
            danger
            loading={writeOff.isPending}
            confirmLabel="Списать"
            message={
              writeOffHolder
                ? `Экземпляр уже числится за сотрудником ${writeOffHolder} — его выдали, пока карточка была открыта. Списание закроет выдачу.`
                : unit.state === 'ISSUED'
                  ? `Экземпляр числится за сотрудником ${unit.holder?.fullName ?? ''}. Списание закроет выдачу и сохранит событие в истории.`
                  : 'Экземпляр исчезнет из рабочих списков и больше не будет выдаваться. История сохранится.'
            }
          />
        </>
      )}
    </>
  );
}
