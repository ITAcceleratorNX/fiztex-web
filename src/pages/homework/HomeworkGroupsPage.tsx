import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, Shuffle } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { homeworkApi, type HomeworkGroup } from '@/lib/homeworkApi';

/**
 * Временные группы: деление класса на непересекающиеся части (Figma 863:573/620/790,
 * ТЗ HOMEWORK-002 §5).
 *
 * Экран правит **набор**, а не отдельные группы: состав внутри набора не должен
 * пересекаться, и следит за этим сервер. Поэтому «добавить группу» и «перемешать» — это
 * одна и та же серверная операция «разложить исходный состав на N частей», а перенос
 * ученика уходит одним вызовом `moves`, а не парой «убрать + добавить».
 *
 * Каждое действие сохраняется сразу: отдельной кнопки «Сохранить» здесь нет, потому что
 * копить перестановки на клиенте — значит держать состав, которого на сервере ещё нет, и
 * рисковать разойтись с чужой правкой.
 *
 * Чего нет: «Инструкция для группы» из макета. Поля под неё в API не существует
 * (`HomeworkGroupView` его не отдаёт), а заводить новую backend-логику ТЗ запрещает.
 */
export function HomeworkGroupsPage() {
  const [params] = useSearchParams();
  const classId = Number(params.get('classId')) || undefined;
  const subjectId = Number(params.get('subjectId')) || undefined;
  const homeworkId = Number(params.get('homeworkId')) || undefined;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  useDocumentTitle('Временные группы');

  const [groupCount, setGroupCount] = useState(2);
  const [dragging, setDragging] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const homeworkQuery = useQuery({
    queryKey: ['homework', 'card', homeworkId],
    queryFn: ({ signal }) => homeworkApi.card(homeworkId as number, signal),
    enabled: homeworkId != null,
  });
  const homework = homeworkQuery.data;

  const setsQuery = useQuery({
    queryKey: ['homework', 'group-sets', classId, subjectId],
    queryFn: ({ signal }) => homeworkApi.listGroupSets(classId as number, subjectId, signal),
    enabled: classId != null,
  });
  const set = setsQuery.data?.[0];

  /**
   * Состав запирается, как только по заданию с этими группами появился хоть один ответ
   * (HOMEWORK-002 §7). Признака в ответе набора нет, поэтому выводим его из задания,
   * из которого пришли; сервер всё равно откажет сам, но лучше не предлагать того,
   * что заведомо не пройдёт.
   */
  const locked = Boolean(homework?.hasAnswers && homework?.recipients?.type === 'TEMP_GROUP');

  const mutate = useMutation({
    mutationFn: async (action:
      | { kind: 'create'; count: number }
      | { kind: 'redistribute'; count: number }
      | { kind: 'move'; studentId: number; targetGroupId: number }) => {
      if (action.kind === 'create') {
        return homeworkApi.createGroupSet({
          classId: classId as number,
          subjectId: subjectId as number,
          groupCount: action.count,
          source: 'CLASS',
          random: true,
        });
      }
      if (action.kind === 'redistribute') {
        return homeworkApi.redistributeGroupSet(set?.id as number, {
          groupCount: action.count,
          source: 'CLASS',
        });
      }
      return homeworkApi.moveGroupStudent(set?.id as number, action.studentId, action.targetGroupId);
    },
    onSuccess: (_data, action) => {
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
      if (action.kind === 'create') toast.success('Класс разделён на группы');
      if (action.kind === 'redistribute') toast.success('Состав пересобран');
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Не удалось изменить состав групп',
      );
    },
  });

  if (classId == null || subjectId == null) {
    return (
      <div className="card">
        <EmptyBlock
          title="Не указан класс или предмет"
          description="Группы заводятся для конкретной пары «класс + предмет» — откройте экран из задания."
          action={
            <Link to="/homework" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              К списку заданий
            </Link>
          }
        />
      </div>
    );
  }

  if (setsQuery.isPending) return <LoadingBlock label="Загрузка групп…" />;
  if (setsQuery.isError) {
    return (
      <div className="card">
        <ErrorBlock message="Не удалось загрузить группы" onRetry={() => void setsQuery.refetch()} />
      </div>
    );
  }

  const groups = set?.groups ?? [];
  const busy = mutate.isPending;
  const backTo = homeworkId ? `/homework/${homeworkId}` : '/homework';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={backTo} aria-label="Назад" className="text-subtle transition hover:text-ink">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-28 font-bold text-ink">Временные группы</h1>
        </div>

        {set && !locked && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => mutate.mutate({ kind: 'redistribute', count: groups.length })}
            >
              <Shuffle className="size-4" aria-hidden /> Перемешать случайно
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => mutate.mutate({ kind: 'redistribute', count: groups.length + 1 })}
            >
              + Добавить группу
            </Button>
          </div>
        )}
      </div>

      {homework && (
        <div className="rounded-xl bg-neutral-bg/60 px-5 py-3 text-13">
          <span className="text-subtle">ДЗ: </span>
          <span className="font-medium text-ink">{homework.title}</span>
          <span className="mx-2 text-subtle">·</span>
          <span className="text-subtle">Класс: </span>
          <span className="font-medium text-ink">{homework.className}</span>
        </div>
      )}

      {locked && (
        <NoticeBar tone="soft">
          Состав закрыт: по заданию уже есть ответы учеников. Группы можно смотреть, но не
          менять — иначе работа оказалась бы у ученика, которого в группе больше нет.
        </NoticeBar>
      )}

      {!set ? (
        <div className="card">
          <EmptyBlock
            title="Класс ещё не разделён"
            description="Выберите, на сколько групп разделить класс — состав распределится случайно, а потом его можно поправить вручную."
            action={
              <div className="flex items-end gap-2">
                <Field label="Групп">
                  <Select
                    className="w-auto"
                    value={String(groupCount)}
                    onChange={(event) => setGroupCount(Number(event.target.value))}
                  >
                    {[2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Select>
                </Field>
                <Button
                  loading={busy}
                  onClick={() => mutate.mutate({ kind: 'create', count: groupCount })}
                >
                  Разделить класс
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {/*
            Перенос вынесен из строки: кнопка в каждой строке съедала имя и повторялась
            двадцать раз ради действия, которое за раз делают с одним учеником. Здесь
            ученик сначала выбирается, а кнопки появляются одной панелью — и заодно это
            единственный способ перенести с клавиатуры, потому что перетаскивание мышью
            доступно не всем.
          */}
          <MoveBar
            groups={groups}
            selected={selected}
            disabled={locked || busy}
            onMove={(targetGroupId) => {
              if (selected == null) return;
              mutate.mutate({ kind: 'move', studentId: selected, targetGroupId });
              setSelected(null);
            }}
            onCancel={() => setSelected(null)}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <GroupColumn
                key={group.id}
                group={group}
                locked={locked || busy}
                dragging={dragging}
                selected={selected}
                onSelect={(studentId) =>
                  setSelected((prev) => (prev === studentId ? null : studentId))
                }
                onDragStart={setDragging}
                onDragEnd={() => setDragging(null)}
                onDrop={(targetGroupId) => {
                  if (dragging == null) return;
                  setDragging(null);
                  mutate.mutate({ kind: 'move', studentId: dragging, targetGroupId });
                }}
              />
            ))}
          </div>
        </>
      )}

      {set && !locked && (
        <div>
          <Button variant="secondary" onClick={() => navigate(backTo)}>
            Готово
          </Button>
        </div>
      )}
    </div>
  );
}

function MoveBar({
  groups,
  selected,
  disabled,
  onMove,
  onCancel,
}: {
  groups: HomeworkGroup[];
  selected: number | null;
  disabled: boolean;
  onMove: (targetGroupId: number) => void;
  onCancel: () => void;
}) {
  const student = groups
    .flatMap((group) => (group.students ?? []).map((s) => ({ ...s, groupId: group.id })))
    .find((s) => s.studentProfileId === selected);

  if (!student) {
    return (
      <p className="text-13 text-subtle">
        Перетащите ученика в другую группу — или выберите его, чтобы перенести кнопкой.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-info-bg px-4 py-2.5">
      <span className="text-13">
        <span className="text-subtle">Перенести: </span>
        <span className="font-medium text-ink">{student.fullName}</span>
      </span>
      <span className="text-subtle">→</span>
      {groups
        .filter((group) => group.id !== student.groupId)
        .map((group) => (
          <Button
            key={group.id}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => group.id != null && onMove(group.id)}
          >
            {group.name}
          </Button>
        ))}
      <button
        type="button"
        onClick={onCancel}
        className="ml-auto text-13 text-subtle transition hover:text-ink"
      >
        Отмена
      </button>
    </div>
  );
}

function GroupColumn({
  group,
  locked,
  dragging,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  group: HomeworkGroup;
  locked: boolean;
  dragging: number | null;
  selected: number | null;
  onSelect: (studentId: number) => void;
  onDragStart: (studentId: number) => void;
  onDragEnd: () => void;
  onDrop: (targetGroupId: number) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <section
      onDragOver={(event) => {
        if (locked || dragging == null) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false);
        if (!locked && group.id != null) onDrop(group.id);
      }}
      className={cx(
        'card flex flex-col gap-2 p-4 transition',
        over && 'ring-2 ring-brand-400/60',
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="rounded-lg bg-neutral-bg px-2.5 py-1 text-13 font-semibold text-ink">
          {group.name}
        </span>
        <span className="text-13 text-subtle">{group.students?.length ?? 0} уч.</span>
      </header>

      {(group.students ?? []).length === 0 ? (
        <p className="py-6 text-center text-13 text-subtle">Пусто — перетащите сюда учеников</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {group.students?.map((student) => {
            const isSelected = selected === student.studentProfileId;
            return (
              <li key={student.studentProfileId}>
                <button
                  type="button"
                  draggable={!locked}
                  disabled={locked}
                  aria-pressed={isSelected}
                  onClick={() => student.studentProfileId != null && onSelect(student.studentProfileId)}
                  onDragStart={() => student.studentProfileId != null && onDragStart(student.studentProfileId)}
                  onDragEnd={onDragEnd}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
                    isSelected
                      ? 'border-navy-400 bg-info-bg text-navy-700'
                      : 'border-line bg-surface text-ink hover:border-navy-400',
                    !locked && 'cursor-grab active:cursor-grabbing',
                    dragging === student.studentProfileId && 'opacity-50',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{student.fullName}</span>
                  <GripVertical
                    className={cx('size-4 shrink-0 text-subtle', locked && 'opacity-40')}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
