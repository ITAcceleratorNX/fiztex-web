import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { AttachmentChip } from '@/pages/homework/AttachmentLink';
import {
  useAddLessonMaterialFile,
  useAddLessonMaterialLink,
  useDeleteLessonMaterial,
  useLesson,
  useLessonMaterials,
  useSetLessonMaterialVisibility,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { lessonMaterialsApi, type LessonMaterial } from '@/lib/homeworkAiApi';
import { formatWeekdayDayMonth } from '@/lib/format';

/**
 * Материалы урока — модуль карточки урока (ТЗ HOMEWORK-BE-006, LESSON-MAT-001).
 *
 * Отдельная страница, а не блок в карточке: посещаемость, домашние задания и оценки
 * открываются с плиток своими экранами, и материалы обязаны вести себя так же — иначе
 * один из четырёх модулей ведёт себя не как остальные три.
 *
 * <p>Ученик и родитель сюда тоже заходят: им видны материалы с признаком «видно
 * ученикам», без переключателей и кнопок. Скрытые материалы бэкенд им не отдаёт вовсе,
 * поэтому фильтровать здесь нечего.
 */
export function LessonMaterialsPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = Number(lessonId);
  const valid = Number.isFinite(id) && id > 0;
  const toast = useToast();

  useDocumentTitle('Материалы урока');

  const lessonQuery = useLesson(valid ? id : null);
  const materialsQuery = useLessonMaterials(valid ? id : null);
  const addFile = useAddLessonMaterialFile(id);
  const addLink = useAddLessonMaterialLink(id);
  const setVisibility = useSetLessonMaterialVisibility(id);
  const removeMaterial = useDeleteLessonMaterial(id);

  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [pendingDelete, setPendingDelete] = useState<LessonMaterial | null>(null);

  const lesson = lessonQuery.data;
  const materials = materialsQuery.data ?? [];
  const canManage = lesson?.capabilities?.includes('EDIT_TEACHING_PART') ?? false;
  const busy = addFile.isPending || addLink.isPending;

  function report(error: unknown, fallback: string) {
    toast.error(error instanceof ApiError ? error.message : fallback);
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      await addFile.mutateAsync(file);
      toast.success('Материал добавлен');
    } catch (error) {
      report(error, 'Не удалось загрузить файл');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function onAddLink(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      await addLink.mutateAsync(trimmed);
      setUrl('');
      toast.success('Ссылка добавлена');
    } catch (error) {
      report(error, 'Не удалось добавить ссылку');
    }
  }

  async function onToggleVisibility(material: LessonMaterial, visible: boolean) {
    if (material.id == null) return;
    try {
      await setVisibility.mutateAsync({ materialId: material.id, visibleToStudents: visible });
    } catch (error) {
      report(error, 'Не удалось изменить видимость');
    }
  }

  async function onDelete() {
    const material = pendingDelete;
    if (!material?.id) return;
    try {
      await removeMaterial.mutateAsync(material.id);
      toast.success('Материал удалён');
    } catch (error) {
      report(error, 'Не удалось удалить материал');
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          to={`/lesson-schedule/lessons/${id}`}
          aria-label="К уроку"
          className="text-subtle transition hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-28 font-bold text-ink">Материалы урока</h1>
          {lesson && (
            <p className="text-13 text-muted">
              {[
                lesson.subjectName,
                lesson.subgroupName
                  ? `${lesson.className} · ${lesson.subgroupName}`
                  : lesson.className,
                lesson.date ? formatWeekdayDayMonth(lesson.date) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>

      {materialsQuery.isPending ? (
        <div className="card">
          <LoadingBlock label="Загрузка материалов…" />
        </div>
      ) : materialsQuery.isError ? (
        <div className="card">
          <ErrorBlock
            message="Не удалось загрузить материалы урока"
            onRetry={() => void materialsQuery.refetch()}
          />
        </div>
      ) : materials.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title="Материалов пока нет"
            description={
              canManage
                ? 'Приложите конспект, презентацию или ссылку. По этим материалам можно будет сгенерировать домашнее задание.'
                : 'Материалы к уроку прикладывает учитель.'
            }
          />
        </div>
      ) : (
        <ul className="card flex flex-col divide-y divide-slate-100 p-0">
          {materials.map((material) => (
            <MaterialRow
              key={material.id}
              lessonId={id}
              material={material}
              canManage={canManage}
              onToggleVisibility={onToggleVisibility}
              onDelete={() => setPendingDelete(material)}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(event) => void onPickFile(event.target.files?.[0])}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              Загрузить файл
            </Button>
            <span className="text-11 text-subtle">Документ, PDF или фотография, до 50 МБ</span>
          </div>

          {/* Одно поле не стоит модального окна — форма живёт прямо на странице. */}
          <form className="flex flex-wrap items-center gap-3" onSubmit={onAddLink}>
            <Link2 className="size-4 text-subtle" aria-hidden />
            <TextInput
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              className="min-w-[260px] flex-1"
            />
            <Button type="submit" variant="secondary" disabled={busy || !url.trim()}>
              Добавить ссылку
            </Button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title="Удалить материал?"
        message={
          pendingDelete
            ? `«${materialTitle(pendingDelete)}» пропадёт из урока. Ученики больше не увидят этот материал.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        loading={removeMaterial.isPending}
        onConfirm={() => void onDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function MaterialRow({
  lessonId,
  material,
  canManage,
  onToggleVisibility,
  onDelete,
}: {
  lessonId: number;
  material: LessonMaterial;
  canManage: boolean;
  onToggleVisibility: (material: LessonMaterial, visible: boolean) => void;
  onDelete: () => void;
}) {
  const visible = material.visibleToStudents ?? true;

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        {material.kind === 'LINK' ? (
          <a
            href={material.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-13 text-link hover:underline"
          >
            {material.url}
          </a>
        ) : (
          <AttachmentChip
            attachment={material}
            load={(materialId) => lessonMaterialsApi.content(lessonId, materialId)}
          />
        )}
        {/* Подпись словом, а не иконкой глаза: иконка требует догадки, слово — нет. */}
        {!visible && (
          <span className="ml-2 align-middle">
            <Badge tone="gray">Только для учителя</Badge>
          </span>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-3">
          <span className="text-11 text-subtle">
            {visible ? 'Видно ученикам' : 'Скрыт'}
          </span>
          <Switch checked={visible} onChange={(next) => onToggleVisibility(material, next)} />
          <button
            type="button"
            onClick={onDelete}
            aria-label="Удалить материал"
            className="text-subtle transition hover:text-red-600"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

function materialTitle(material: LessonMaterial): string {
  return material.fileName ?? material.url ?? 'материал';
}
