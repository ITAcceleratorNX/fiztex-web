import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { DataTable, TableCell, TableHead } from '@/components/ui/DataTable';
import { useKtpBinding, useKtpCommand, useKtpHistoricalLessons, useKtpProgress } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { ktpApi } from '@/lib/ktpApi';
import type { Schema } from '@/lib/apiSchemas';
import { formatDateTime } from '@/lib/format';
import { ktpHours } from '@/lib/ktpModel';
import { ktpShareUnits } from '@/lib/ktpVersionSplitModel';
import { ktpError } from './KtpShared';

type TopicChoice = { topicId: string; units: string };
type Review = { request: Schema<'KtpHistoricalLinkRequest'>; preview: Schema<'KtpHistoricalLinkPreview'> };

export function KtpHistoricalLinkModal({ bindingId, classLabel, subjectLabel, yearLabel, onClose }: {
  bindingId: number; classLabel?: string; subjectLabel?: string; yearLabel?: string; onClose: () => void;
}) {
  const binding = useKtpBinding(bindingId);
  const progress = useKtpProgress(bindingId);
  const [date, setDate] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [topics, setTopics] = useState<TopicChoice[]>([{ topicId: '', units: '1' }]);
  const [reason, setReason] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [confirmation, setConfirmation] = useState<Schema<'KtpHistoricalLinkConfirmation'> | null>(null);
  const [acceptBaseline, setAcceptBaseline] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lessons = useKtpHistoricalLessons(binding.data?.classId ?? 0, binding.data?.subjectId ?? 0, date);
  const preview = useKtpCommand(ktpApi.historicalPreview, false);
  const confirm = useKtpCommand(ktpApi.historicalLink);
  const toast = useToast();
  const availableLessons = lessons.data?.pages.flatMap(page => page.content ?? []).filter(lesson =>
    lesson.classId === binding.data?.classId && lesson.subjectId === binding.data?.subjectId
    && lesson.status === 'ACTIVE' && lesson.temporalStatus === 'FINISHED'
    && lesson.targetType === 'CLASS' && lesson.subgroupId == null
    && lesson.capabilities?.includes('EDIT_TEACHING_PART')) ?? [];
  const selectedLesson = availableLessons.find(lesson => String(lesson.id) === lessonId);
  const currentTopics = progress.data?.topics ?? [];
  const duplicate = new Set(topics.map(topic => topic.topicId)).size !== topics.length;
  const validTopics = topics.length > 0 && !duplicate && topics.every(topic => topic.topicId
    && currentTopics.some(current => String(current.topicId) === topic.topicId) && ktpShareUnits(topic.units) != null);
  const allowed = ['READY', 'AWAITING_INITIAL_SYNC'].includes(binding.data?.state ?? '');
  const valid = !!selectedLesson && validTopics && reason.trim().length >= 3 && reason.trim().length <= 1000
    && allowed && !needsRefresh && !binding.isFetching && !progress.isFetching && !lessons.isFetching;

  useEffect(() => {
    if (review && (review.request.expectedBindingRevision !== binding.data?.revision
      || review.request.expectedProgressRevision !== progress.data?.progressRevision)) {
      setReview(null); setConfirmation(null); setAcceptBaseline(false); setNeedsRefresh(true);
    }
  }, [review, binding.data?.revision, progress.data?.progressRevision]);

  function edited() {
    setReview(null); setConfirmation(null); setAcceptBaseline(false); preview.reset(); confirm.reset();
  }
  function chooseTopic(index: number, next: Partial<TopicChoice>) {
    setTopics(previous => previous.map((topic, position) => position === index ? { ...topic, ...next } : topic)); edited();
  }
  function recordConflict(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      setReview(null); setConfirmation(null); setAcceptBaseline(false); setNeedsRefresh(true);
    }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      const [b, p, l] = await Promise.all([binding.refetch(), progress.refetch(), lessons.refetch()]);
      if (!b.isError && !p.isError && !l.isError) { edited(); setNeedsRefresh(false); }
    } finally { setRefreshing(false); }
  }
  async function calculate() {
    if (!valid) return;
    const request: Schema<'KtpHistoricalLinkRequest'> = {
      expectedBindingRevision: binding.data?.revision, expectedProgressRevision: progress.data?.progressRevision,
      lessonId: Number(lessonId), topics: topics.map(topic => ({ topicId: Number(topic.topicId), units: ktpShareUnits(topic.units)! / 10000 })),
      reason: reason.trim(),
    };
    try { setReview({ request, preview: await preview.mutateAsync({ id: bindingId, body: request }) }); }
    catch (error) { recordConflict(error); }
  }
  async function save() {
    if (!review || !valid || (review.preview.baselineChanges?.length && !acceptBaseline)) return;
    const body = confirmation ?? { request: review.request,
      previewFingerprint: review.preview.previewFingerprint,
      acceptBaselineAdjustment: !review.preview.baselineChanges?.length || acceptBaseline };
    setConfirmation(body);
    try {
      await confirm.mutateAsync({ id: bindingId, body });
      toast.success('Проведённый урок связан с КТП. Прогресс обновлён'); onClose();
    } catch (error) { recordConflict(error); }
  }
  const busy = preview.isPending || confirm.isPending || refreshing;
  const error = preview.error ?? confirm.error;
  const title = review ? 'Подтвердить привязку проведённого урока?' : 'Связать проведённый урок с КТП';

  return <Modal open onClose={() => { if (!busy) onClose(); }} title={title}
    subtitle={[subjectLabel, classLabel, yearLabel].filter(Boolean).join(' · ')} size="lg" scrollable footer={<>
      <Button variant="secondary" disabled={busy} onClick={() => review ? edited() : onClose()}>{review ? 'Назад к выбору' : 'Отмена'}</Button>
      {review ? <Button loading={confirm.isPending} disabled={!valid || busy || (!!review.preview.baselineChanges?.length && !acceptBaseline)}
        onClick={() => void save()}>{confirm.isError && !needsRefresh ? 'Повторить подтверждение' : 'Подтвердить привязку'}</Button>
        : <Button loading={preview.isPending} disabled={!valid || busy} onClick={() => void calculate()}>Проверить привязку</Button>}
    </>}>
    <div className="space-y-5">
      <p className="text-13 text-muted">Выберите существующий урок, который действительно состоялся. Привязка укажет его фактические темы КТП и обновит прогресс; новый урок не создаётся. Ранее сохранённая тема останется в истории.</p>
      {binding.isPending || progress.isPending ? <LoadingBlock /> : binding.isError || progress.isError
        ? <ErrorBlock message={ktpError(binding.error ?? progress.error)} onRetry={() => { void binding.refetch(); void progress.refetch(); }} />
        : !allowed ? <StatusNotice tone="warning">Сначала завершите сверку текущей версии КТП. Для удалённого плана историческая привязка недоступна.</StatusNotice>
          : review ? <>
            <div className="space-y-2 rounded-lg border border-line p-4 text-13">
              <p className="font-semibold text-ink">{formatDateTime(selectedLesson?.startsAt)} · {selectedLesson?.className} · {selectedLesson?.subjectName}</p>
              <p className="text-muted">Сейчас в уроке: {selectedLesson?.topic || 'Тема не указана'}</p>
              <Link className="font-semibold text-navy-700 hover:underline" target="_blank" rel="noreferrer"
                to={`/lesson-schedule/lessons/${review.request.lessonId}`}>Открыть карточку урока</Link>
              <p className="pt-2 font-semibold text-ink">Фактические темы после привязки:</p>
              <ul className="list-disc space-y-1 pl-5">{review.request.topics?.map(topic => <li key={topic.topicId}>
                {currentTopics.find(current => current.topicId === topic.topicId)?.title} · {ktpHours(topic.units!)} ч
              </li>)}</ul>
              <p className="pt-2 text-muted">Основание: {reason}</p>
            </div>
            {!!review.preview.baselineChanges?.length && <>
              <StatusNotice tone="warning">Часть часов уже включена в начальный прогресс. Проверьте уменьшение ниже, чтобы не посчитать их дважды.</StatusNotice>
              <DataTable label="Пересчёт начального прогресса"><thead><tr><TableHead>Тема</TableHead><TableHead>До привязки, ч</TableHead><TableHead>После привязки, ч</TableHead></tr></thead><tbody>
                {review.preview.baselineChanges.map(change => <tr key={change.topicId}><TableCell>{currentTopics.find(topic => topic.topicId === change.topicId)?.title}</TableCell>
                  <TableCell>{ktpHours(change.before ?? 0)}</TableCell><TableCell>{ktpHours(change.after ?? 0)}</TableCell></tr>)}
              </tbody></DataTable>
              <label className="flex items-start gap-3 text-13"><input type="checkbox" className="mt-1 size-4 accent-navy-700" checked={acceptBaseline}
                onChange={event => setAcceptBaseline(event.target.checked)} disabled={busy || !!confirmation} />Подтверждаю пересчёт начального прогресса без двойного учёта часов</label>
            </>}
            {!review.preview.baselineChanges?.length && <StatusNotice>Начальный прогресс не изменяется. Запись появится в истории темы выбранного урока.</StatusNotice>}
          </> : <>
            <Field label="Дата проведённого урока" required><TextInput type="date" value={date} disabled={busy}
              onChange={event => { setDate(event.target.value); setLessonId(''); edited(); }} /></Field>
            {!date ? <p className="text-13 text-muted">Выберите дату, чтобы найти существующие занятия своего класса и предмета.</p>
              : lessons.isPending ? <LoadingBlock label="Загрузка проведённых уроков…" /> : lessons.isError
                ? <ErrorBlock message={ktpError(lessons.error)} onRetry={() => void lessons.refetch()} />
                : <>
                  {availableLessons.length ? <Field label="Проведённый урок" required><Select value={lessonId} disabled={busy}
                    onChange={event => { setLessonId(event.target.value); edited(); }}>
                    <option value="">Выберите урок</option>{availableLessons.map(lesson => <option key={lesson.id} value={lesson.id}>
                      {`${formatDateTime(lesson.startsAt)} · ${lesson.className} · ${lesson.subjectName}${lesson.topic ? ` · ${lesson.topic}` : ''}`}
                    </option>)}
                  </Select></Field> : <EmptyBlock title="Подходящих проведённых уроков не найдено"
                    description="Проверьте дату. Нужен завершённый урок всего класса по этому предмету, доступный вам для редактирования. Отменённые занятия и подгруппы не предлагаются." />}
                  {lessons.hasNextPage && <Button variant="secondary" size="sm" loading={lessons.isFetchingNextPage}
                    onClick={() => void lessons.fetchNextPage()}>Показать ещё уроки</Button>}
                </>}
            <div className="space-y-4">{topics.map((topic, index) => <div key={index} className="space-y-3 rounded-lg border border-line p-4">
              <Field label={`Тема КТП ${index + 1}`} required><Select value={topic.topicId} disabled={busy}
                onChange={event => chooseTopic(index, { topicId: event.target.value })}>
                <option value="">Выберите тему текущей версии</option>{currentTopics.map(current => <option key={current.topicId} value={current.topicId}>
                  {`${current.order}. ${current.title} · ${current.coveredHours ?? 0} из ${current.plannedHours} ч`}
                </option>)}
              </Select></Field>
              <Field label={`Часы темы ${index + 1} в уроке`} required hint="Больше 0 и не больше 1; до четырёх знаков после запятой.">
                <TextInput type="number" min="0.0001" max="1" step="0.0001" disabled={busy} value={topic.units}
                  onChange={event => chooseTopic(index, { units: event.target.value })} />
              </Field>
              {topics.length > 1 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setTopics(previous => previous.filter((_, position) => position !== index)); edited(); }}>Убрать тему {index + 1}</Button>}
            </div>)}</div>
            {topics.length < 100 && <Button variant="secondary" size="sm" disabled={busy || topics.length >= currentTopics.length}
              onClick={() => { setTopics(previous => [...previous, { topicId: '', units: '1' }]); edited(); }}>Добавить ещё тему урока</Button>}
            {duplicate && <p role="status" className="text-13 text-danger-fg">Выберите каждую тему только один раз.</p>}
            <Field label="Основание исторической привязки" required hint="Укажите, по каким школьным записям подтверждены урок и темы. От 3 до 1000 знаков.">
              <TextArea value={reason} maxLength={1000} rows={3} disabled={busy} onChange={event => { setReason(event.target.value); edited(); }} />
            </Field>
          </>}
      {error && <StatusNotice tone="error">{ktpError(error)}</StatusNotice>}
      {confirm.isError && !needsRefresh && review && <StatusNotice tone="warning">Подтверждение не получено. Повторите ту же операцию: выбранные темы, основание и ваше согласие сохраняются.</StatusNotice>}
      {needsRefresh && <StatusNotice tone="warning">Урок или прогресс изменились. Обновите данные и проверьте привязку заново.
        <div className="mt-3"><Button variant="secondary" size="sm" loading={refreshing} onClick={() => void refresh()}>Обновить данные</Button></div>
      </StatusNotice>}
    </div>
  </Modal>;
}
