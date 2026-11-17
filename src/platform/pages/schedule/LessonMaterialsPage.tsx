import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { AttachmentChip } from '@/pages/homework/AttachmentLink';
import { WorkspaceMaterialPickerModal } from '@/components/workspace/WorkspaceMaterialPickerModal';
import {
  useAddLessonMaterialFile,
  useAddLessonMaterialLink,
  useAttachWorkspaceDocumentToLesson,
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
import { LessonTextbookSection } from './LessonTextbookSection';
import { LessonSummarySection } from './LessonSummarySection';
import { LessonHomeworkSection } from './LessonHomeworkSection';

/**
 * Материалы урока — модуль карточки урока (ТЗ HOMEWORK-BE-006, LESSON-MAT-001).
 *
 * <p>С KSP-FE-001 страница собирает всё, что видят ученики (Figma 2212:9448, 2212:9521): учебник,
 * домашнее задание, конспект урока, файлы и ссылки. У каждого раздела подписано, когда его видят
 * ученики. Учебник, задания и конспект переехали сюда с карточки урока; права, публикация и
 * отметка «ДЗ не задано» не менялись.
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
  const attachWorkspace = useAttachWorkspaceDocumentToLesson();
  const setVisibility = useSetLessonMaterialVisibility(id);
  const removeMaterial = useDeleteLessonMaterial(id);

  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [pendingDelete, setPendingDelete] = useState<LessonMaterial | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);

  const lesson = lessonQuery.data;
  const materials = materialsQuery.data ?? [];
  const canManage = lesson?.capabilities?.includes('EDIT_TEACHING_PART') ?? false;
  const periodClosed = lesson?.academicPeriodStatus != null && lesson.academicPeriodStatus !== 'ACTIVE';
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
    <div className="flex flex-col gap-6">
      <Link
        to={`/lesson-schedule/lessons/${id}`}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-navy-700 hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        К уроку
      </Link>
      <div className="-mt-2 flex flex-col gap-1">
          <h1 className="text-28 font-bold text-ink">Материалы урока</h1>
          {lesson && (
            <p className="text-sm text-planning-muted">
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

      {valid && <LessonTextbookSection lessonId={id} locked={periodClosed} />}
      {/* ДЗ — сразу после учебника: с карточки урока сюда переехал отдельный блок заданий. */}
      {lesson && <LessonHomeworkSection lesson={lesson} locked={periodClosed} />}
      {valid && <LessonSummarySection lessonId={id} />}

      <h2 className="text-base font-semibold text-ink">Файлы и ссылки</h2>

      {materialsQuery.isPending ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <LoadingBlock label="Загрузка материалов…" />
        </div>
      ) : materialsQuery.isError ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <ErrorBlock
            message="Не удалось загрузить материалы урока"
            onRetry={() => void materialsQuery.refetch()}
          />
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyBlock
            title="Файлов и ссылок пока нет"
            description={
              canManage
                ? 'Приложите презентацию, документ или ссылку. По этим материалам можно будет сгенерировать домашнее задание.'
                : 'Материалы к уроку прикладывает учитель.'
            }
          />
        </div>
      ) : (
        <ul className="rounded-2xl border border-slate-200 bg-white flex flex-col divide-y divide-slate-100 p-0">
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
        <div className="rounded-2xl border border-slate-200 bg-white flex flex-col gap-4 p-5">
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
              icon={<Upload className="size-4" aria-hidden />}
            >
              Загрузить файл
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setWorkspacePickerOpen(true)}
              icon={<FolderOpen className="size-4" aria-hidden />}>
              Выбрать из рабочего пространства
            </Button>
            <span className="text-xs text-planning-muted">Документ, PDF или фотография, до 50 МБ</span>
          </div>

          {/* Одно поле не стоит модального окна — форма живёт прямо на странице. */}
          <form className="flex items-center gap-3" onSubmit={onAddLink}>
            <TextInput
              aria-label="Ссылка"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Ссылка на видео, сайт или документ"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" disabled={busy || !url.trim()}>
              Добавить
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
      {workspacePickerOpen && <WorkspaceMaterialPickerModal usage="ATTACH_DOCUMENT_TO_LESSON"
        onClose={() => setWorkspacePickerOpen(false)}
        onConfirm={async (items) => {
          for (const item of items) {
            if (item.id == null) continue;
            await attachWorkspace.mutateAsync({ lessonId: id, itemId: item.id, visibleToStudents: true });
          }
          toast.success('Материалы добавлены к уроку');
        }} />}
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
            <Badge appearance="label" size="xs" tone="gray">Только для учителя</Badge>
          </span>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-3">
          <span className="text-13 text-planning-muted">
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
