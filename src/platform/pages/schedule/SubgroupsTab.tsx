import { Users } from 'lucide-react';
import { EmptyBlock } from '@/components/ui/StateBlock';

const CLASS_ID_PARAM = 'classId';
const SET_ID_PARAM = 'setId';

export type SubgroupsTabState = {
  classId: number | null;
  setId: number | null;
};

export function parseSubgroupsTabState(params: URLSearchParams): SubgroupsTabState {
  const classRaw = params.get(CLASS_ID_PARAM);
  const setRaw = params.get(SET_ID_PARAM);
  const classId = classRaw != null ? Number(classRaw) : NaN;
  const setId = setRaw != null ? Number(setRaw) : NaN;
  return {
    classId: Number.isFinite(classId) && classId > 0 ? classId : null,
    setId: Number.isFinite(setId) && setId > 0 ? setId : null,
  };
}

export function writeSubgroupsTabState(next: URLSearchParams, state: SubgroupsTabState) {
  if (state.classId != null) next.set(CLASS_ID_PARAM, String(state.classId));
  else next.delete(CLASS_ID_PARAM);
  if (state.setId != null) next.set(SET_ID_PARAM, String(state.setId));
  else next.delete(SET_ID_PARAM);
}

/**
 * Shell for stage 8: group sets, auto-split, membership UI.
 * URL state (`classId`, `setId`) is wired so deep-links survive reload.
 */
export function SubgroupsTab({
  yearId,
  state,
}: {
  yearId: number;
  state: SubgroupsTabState;
  onStateChange: (next: SubgroupsTabState) => void;
}) {
  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Наборы групп и состав подгрупп внутри класса. Учебный год: #{yearId}.
        {state.classId != null && <> Класс: #{state.classId}.</>}
        {state.setId != null && <> Набор: #{state.setId}.</>}
      </p>
      <EmptyBlock
        icon={<Users className="h-7 w-7" />}
        title="Подгруппы — скоро"
        description="Выбор класса, наборы, автоделение и перенос учеников появятся на stage 8. Состояние вкладки уже хранится в URL."
      />
    </div>
  );
}
