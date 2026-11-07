import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useKtpCommand, useKtpCopyTargets } from '@/hooks/queries';
import { ktpApi, type KtpCopyTargets } from '@/lib/ktpApi';
import { ktpCount, ktpHours, ktpPaths } from '@/lib/ktpModel';
import { ktpError } from './KtpShared';

type CopyYear = NonNullable<KtpCopyTargets['years']>[number];
const free = (year?: CopyYear) => year?.classes?.filter(c => c.availability === 'AVAILABLE') ?? [];
const yearLabel = (year: CopyYear) => `${year.academicYear}${year.status === 'ACTIVE' ? ' · текущий' : year.status === 'DRAFT' ? ' · ещё не начался' : ''}`;

/** По умолчанию — ближайший год после года источника, где есть свободный класс. */
function defaultYear(targets?: KtpCopyTargets) {
  const years = targets?.years ?? [];
  const source = years.findIndex(year => year.academicYearId === targets?.source?.academicYearId);
  const later = source >= 0 ? years.slice(source + 1) : years;
  const pick = later.find(year => free(year).length) ?? years.find(year => free(year).length) ?? years[0];
  return pick ? String(pick.academicYearId) : '';
}

/**
 * КТП-COPY: копия подтверждённого КТП в черновик на выбранный год и классы. Причины, по которым
 * класс недоступен, считает сервер (`copy-targets`); окно их только показывает.
 */
export function KtpCopyDialog({ bindingId, versionId, onClose }: { bindingId: number; versionId: number; onClose: () => void }) {
  const query = useKtpCopyTargets(bindingId, versionId);
  const copy = useKtpCommand(ktpApi.copy);
  const toast = useToast();
  const navigate = useNavigate();
  const [year, setYear] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const targets = query.data;
  const source = targets?.source;
  const years = targets?.years ?? [];
  const selectedYear = year || defaultYear(targets);
  const current = years.find(item => String(item.academicYearId) === selectedYear);
  const available = free(current);
  // Класс, ставший недоступным после ответа 409, из выбора выпадает сам; единственный свободный выбран сразу.
  const selection = touched ? classes.filter(id => available.some(c => String(c.classId) === id))
    : available.length === 1 ? [String(available[0].classId)] : [];
  const picked = current?.classes?.filter(c => selection.includes(String(c.classId))) ?? [];
  const withoutLessons = picked.filter(c => !c.hasUpcomingLessons).map(c => c.className);
  const draft = picked.find(c => c.existingDraftId);
  const options = (current?.classes ?? []).map(c => ({ value: String(c.classId), disabled: c.availability !== 'AVAILABLE',
    label: c.availability === 'AVAILABLE' ? c.className ?? '' : `${c.className} — уже есть активный КТП` }));

  function close() { if (!copy.isPending) onClose(); }
  function chooseYear(next: string) { setYear(next); setClasses([]); setTouched(false); }
  function open(id: number) { onClose(); navigate(ktpPaths.draft(id)); }
  async function save() {
    if (!selectedYear || !selection.length) return;
    try {
      const receipt = await copy.mutateAsync({ bindingId, versionId, body: { academicYearId: Number(selectedYear), classIds: selection.map(Number) } });
      toast.success('Черновик копии создан');
      if (receipt.id) open(receipt.id); else onClose();
    } catch { /* Текст ошибки остаётся в окне, ключ повтора — тот же. */ }
  }

  return <Modal open onClose={close} title="Копировать КТП" size="planning" appearance="planning" scrollable
    footer={<><Button variant="ghost" disabled={copy.isPending} onClick={close}>Отмена</Button>
      {!!years.length && <Button variant="primary" disabled={!selection.length || query.isFetching} loading={copy.isPending} onClick={() => void save()}>Создать черновик</Button>}</>}>
    {query.isPending ? <LoadingBlock /> : query.isError ? <ErrorBlock message={ktpError(query.error)} onRetry={() => void query.refetch()} /> : <div className="space-y-4 [&_.input-base]:min-h-12">
      {source && <div className="space-y-1">
        <p className="text-sm font-semibold text-planning-ink">{source.subject} · {source.className} · {source.academicYear} · версия {source.versionNumber}</p>
        <p className="text-xs text-planning-muted">{ktpCount(source.topicCount ?? 0, ['тема', 'темы', 'тем'])}, {ktpHours(Number(source.plannedHours ?? 0))} ч</p>
      </div>}
      <p className="text-sm leading-relaxed text-planning-muted">Скопируется только план: разделы, темы, цели, часы и примечания. Уроки, оценки, ДЗ, посещаемость и прогресс не переносятся. Сроки прошлого года останутся подсказкой в черновике.</p>
      {!years.length ? <EmptyBlock title="Некуда скопировать" description={`Нет классов по предмету «${source?.subject ?? ''}», доступных по вашим назначениям. Если класс нового года ещё не создан или не назначен вам, обратитесь к администратору.`} /> : <>
        <Field label="Учебный год" required><Select value={selectedYear} disabled={copy.isPending} onChange={event => chooseYear(event.target.value)}>{years.map(item => <option key={item.academicYearId} value={item.academicYearId}>{yearLabel(item)}</option>)}</Select></Field>
        <Field label="Предмет"><TextInput disabled value={source?.subject ?? ''} /></Field>
        <Field label="Класс(ы)" required hint="Можно выбрать несколько классов. Прогресс у каждого класса будет свой."><MultiSelect options={options} value={selection} onChange={next => { setClasses(next); setTouched(true); }} disabled={copy.isPending || !available.length} placeholder="Выберите классы" /></Field>
        {current && !available.length && <StatusNotice tone="info">Во всех ваших классах {current.academicYear} уже есть активный КТП по этому предмету. Копия не заменяет действующий план.</StatusNotice>}
        {current && !current.periodsReady && <StatusNotice tone="warning">В {current.academicYear} ещё не настроены учебные периоды. Черновик можно подготовить, подтвердить его получится, когда администратор заведёт периоды.</StatusNotice>}
        {!!withoutLessons.length && <StatusNotice tone="info">У {withoutLessons.join(', ')} ещё нет уроков по предмету. После подтверждения темы распределятся, когда появится расписание.</StatusNotice>}
        {draft?.existingDraftId && <StatusNotice tone="info"><span>У вас уже есть черновик КТП для {draft.className}. </span><Button variant="ghost" size="text" onClick={() => open(draft.existingDraftId!)}>Открыть черновик</Button></StatusNotice>}
      </>}
      {copy.isError && <StatusNotice tone="error">{ktpError(copy.error)}</StatusNotice>}
    </div>}
  </Modal>;
}
