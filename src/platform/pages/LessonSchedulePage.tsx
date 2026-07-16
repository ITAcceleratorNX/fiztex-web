import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS, WEEKDAYS_ORDER } from '../labels';
import {
  archiveSchedule,
  copySchedule,
  createSchedule,
  createScheduleLesson,
  deleteScheduleLesson,
  getSchedule,
  listAcademicYears,
  listClasses,
  listPeriods,
  listScheduleHistory,
  listScheduleLessons,
  listSchedules,
  listSchoolSubjects,
  listTeachers,
  publishSchedule,
  type ClassSchedule,
  type ScheduleHistoryRow,
  type ScheduleLesson,
} from '../services';
import type { AcademicPeriod, AcademicYear, SchoolClass, SchoolSubject, TeacherProfile } from '../types';
import { formatPersonName } from '../types';

export function LessonSchedulePage() {
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClassSchedule | null>(null);
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [history, setHistory] = useState<ScheduleHistoryRow[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [templatePeriods, setTemplatePeriods] = useState<
    Array<{ id: number; lessonNumber: number; startTime: string; endTime: string }>
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [createClassId, setCreateClassId] = useState('');
  const [createPeriodId, setCreatePeriodId] = useState('');
  const [bellTemplateId, setBellTemplateId] = useState('');
  const [copyPeriodId, setCopyPeriodId] = useState('');
  const [pending, setPending] = useState(false);

  const [weekday, setWeekday] = useState<Weekday>('MONDAY');
  const [lessonPeriodId, setLessonPeriodId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');

  useEffect(() => {
    void listAcademicYears()
      .then((y) => {
        setYears(y);
        const active = y.find((item) => item.status === 'ACTIVE') ?? y[0];
        if (active) setYearId(active.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    void Promise.all([
      listPeriods(yearId),
      listClasses({ academicYearId: yearId }),
      scheduleSettingsApi.listBellTemplates(Number(yearId)),
      listSchoolSubjects({ status: 'ACTIVE' }),
      listTeachers(),
    ])
      .then(([p, c, tPage, s, teachersList]) => {
        setPeriods(p);
        setClasses(c);
        setTemplates((tPage.content ?? []).map((t) => ({ id: t.id, name: t.name })));
        setSubjects(s);
        setTeachers(teachersList);
        if (p[0]) {
          setPeriodId((prev) => prev || p[0].id);
          setCreatePeriodId((prev) => prev || p[0].id);
          setCopyPeriodId((prev) => prev || p[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка метаданных'));
  }, [yearId]);

  const reloadSchedules = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listSchedules({
        academicYearId: Number(yearId),
        academicPeriodId: periodId ? Number(periodId) : undefined,
        classId: classFilter ? Number(classFilter) : undefined,
      });
      setSchedules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить расписания');
    } finally {
      setLoading(false);
    }
  }, [yearId, periodId, classFilter]);

  useEffect(() => {
    void reloadSchedules();
  }, [reloadSchedules]);

  const loadDetail = useCallback(async (id: number) => {
    setSelectedId(id);
    try {
      const [sched, lessonsList, hist] = await Promise.all([
        getSchedule(id),
        listScheduleLessons(id),
        listScheduleHistory(id),
      ]);
      setSelected(sched);
      setLessons(lessonsList);
      setHistory(hist);
      if (sched.bellTemplateId) {
        const tpl = await scheduleSettingsApi.getBellTemplate(sched.bellTemplateId);
        setTemplatePeriods(
          (tpl.periods ?? []).map((p) => ({
            id: p.id,
            lessonNumber: p.lessonNumber,
            startTime: p.startTime,
            endTime: p.endTime,
          })),
        );
      } else {
        setTemplatePeriods([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось открыть расписание');
    }
  }, [toast]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!yearId || !createPeriodId || !createClassId) {
      toast.error('Выберите год, период и класс');
      return;
    }
    setPending(true);
    try {
      const created = await createSchedule({
        academicYearId: Number(yearId),
        academicPeriodId: Number(createPeriodId),
        classId: Number(createClassId),
        bellTemplateId: bellTemplateId ? Number(bellTemplateId) : null,
      });
      toast.success('Расписание создано');
      setCreateOpen(false);
      await reloadSchedules();
      await loadDetail(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setPending(false);
    }
  }

  async function handlePublish() {
    if (!selectedId) return;
    try {
      await publishSchedule(selectedId);
      toast.success('Расписание опубликовано');
      await reloadSchedules();
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка публикации');
    }
  }

  async function handleArchive() {
    if (!selectedId || !window.confirm('Архивировать расписание?')) return;
    try {
      await archiveSchedule(selectedId);
      toast.success('Архивировано');
      setSelectedId(null);
      setSelected(null);
      await reloadSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleCopy(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !copyPeriodId) return;
    setPending(true);
    try {
      const res = await copySchedule(selectedId, {
        targetAcademicPeriodId: Number(copyPeriodId),
      });
      toast.success(`Скопировано уроков: ${res.copiedLessons}`);
      setCopyOpen(false);
      await reloadSchedules();
      await loadDetail(res.scheduleId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка копирования');
    } finally {
      setPending(false);
    }
  }

  async function handleAddLesson(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !lessonPeriodId || !subjectId || !teacherId) {
      toast.error('Заполните все поля урока');
      return;
    }
    setPending(true);
    try {
      await createScheduleLesson(selectedId, {
        weekday,
        lessonPeriodId: Number(lessonPeriodId),
        subjectId: Number(subjectId),
        teacherId: Number(teacherId),
        targetType: 'CLASS',
        room: room || null,
      });
      toast.success('Урок добавлен');
      setLessonOpen(false);
      setRoom('');
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Конфликт или ошибка');
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteLesson(lessonId: number) {
    if (!selectedId || !window.confirm('Удалить урок?')) return;
    try {
      await deleteScheduleLesson(selectedId, lessonId);
      toast.success('Урок удалён');
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const classNameOf = (id: number) =>
    classes.find((c) => Number(c.id) === id)?.name ?? `#${id}`;

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Расписания классов: создание, уроки, публикация, копия и история. Нужны школьные предметы и
        шаблон звонков.
      </p>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="lg:w-44">
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-44">
          <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">Все периоды</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-40">
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Все классы</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Создать
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reloadSchedules()} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden p-0">
          {!loading && schedules.length === 0 ? (
            <EmptyBlock title="Нет расписаний" description="Создайте расписание для класса." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Класс</th>
                  <th className="px-4 py-3">Шаблон</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr
                    key={s.id}
                    className={`cursor-pointer border-b border-slate-50 ${selectedId === s.id ? 'bg-brand-50/50' : ''}`}
                    onClick={() => void loadDetail(s.id)}
                  >
                    <td className="px-4 py-3">{s.id}</td>
                    <td className="px-4 py-3 font-medium">{classNameOf(s.classId)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.bellTemplateName}</td>
                    <td className="px-4 py-3">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card space-y-4">
          {!selected ? (
            <EmptyBlock title="Выберите расписание" description="Клик по строке слева." />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {selected.status === 'DRAFT' && (
                  <Button size="sm" onClick={() => void handlePublish()}>
                    Опубликовать
                  </Button>
                )}
                {selected.status !== 'ARCHIVED' && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setLessonOpen(true)}>
                      Добавить урок
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setCopyOpen(true)}>
                      Копировать
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void handleArchive()}>
                      Архив
                    </Button>
                  </>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Уроки</h3>
                {lessons.length === 0 ? (
                  <p className="text-sm text-slate-500">Пока пусто</p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                    {lessons.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                      >
                        <span>
                          {WEEKDAY_LABELS[l.weekday as Weekday] ?? l.weekday} · урок {l.lessonNumber}{' '}
                          · {l.subjectName} · {l.teacherFullName}
                          {l.room ? ` · ${l.room}` : ''}
                        </span>
                        {selected.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteLesson(l.id)}
                          >
                            ×
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">История</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет записей</p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                    {history.map((h) => (
                      <li key={h.id}>
                        {h.actionType} · {h.createdAt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Создать расписание"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} loading={pending}>
              Создать
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Класс" required>
            <Select
              value={createClassId}
              onChange={(e) => setCreateClassId(e.target.value)}
              required
            >
              <option value="">Выберите</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Период" required>
            <Select
              value={createPeriodId}
              onChange={(e) => setCreatePeriodId(e.target.value)}
              required
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Шаблон звонков">
            <Select value={bellTemplateId} onChange={(e) => setBellTemplateId(e.target.value)}>
              <option value="">По умолчанию класса</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Копировать расписание"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCopy} loading={pending}>
              Копировать
            </Button>
          </>
        }
      >
        <form onSubmit={handleCopy} className="space-y-3">
          <Field label="Целевой период" required>
            <Select value={copyPeriodId} onChange={(e) => setCopyPeriodId(e.target.value)} required>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={lessonOpen}
        onClose={() => setLessonOpen(false)}
        title="Добавить урок"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLessonOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddLesson} loading={pending}>
              Добавить
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddLesson} className="space-y-3">
          <Field label="День">
            <Select value={weekday} onChange={(e) => setWeekday(e.target.value as Weekday)}>
              {WEEKDAYS_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Слот звонков" required>
            <Select
              value={lessonPeriodId}
              onChange={(e) => setLessonPeriodId(e.target.value)}
              required
            >
              <option value="">Выберите</option>
              {templatePeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  Урок {p.lessonNumber} ({p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Предмет" required>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
              <option value="">Выберите</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Учитель" required>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
              <option value="">Выберите</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatPersonName(t.lastName, t.firstName, t.middleName)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Кабинет">
            <TextInput value={room} onChange={(e) => setRoom(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
