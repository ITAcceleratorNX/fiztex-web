import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  useDeleteMaterial,
  useMaterials,
  useRetryMaterialExtract,
  useSubjects,
} from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MaterialStatusBadge } from '@/components/ui/MaterialStatusBadge';
import { SearchInput } from '@/components/ui/SearchInput';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MaterialUploadModal } from '@/pages/modals/MaterialUploadModal';
import { MaterialFormModal } from '@/pages/modals/MaterialFormModal';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatFileSize, formatFileType, pluralRu } from '@/lib/format';
import type { Material } from '@/lib/types';

export function SubjectMaterialsPage() {
  const { subjectId: subjectIdParam } = useParams();
  const subjectId = Number(subjectIdParam);
  const { data: subjects } = useSubjects();
  const { data, isLoading, isError, error, refetch, isSuccess } = useMaterials(subjectId);
  const del = useDeleteMaterial(subjectId);
  const retry = useRetryMaterialExtract(subjectId);
  const toast = useToast();

  const subject = subjects?.find((s) => s.id === subjectId);

  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((m) => {
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.topic?.toLowerCase().includes(q) ?? false) ||
        m.originalFilename.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  async function handleDownload(material: Material) {
    setDownloadingId(material.id);
    try {
      const { url } = await api.getMaterialDownloadUrl(material.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось скачать файл');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRetry(material: Material) {
    try {
      await retry.mutateAsync(material.id);
      toast.success('Извлечение текста перезапущено');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось перезапустить извлечение');
    }
  }

  async function handleDelete(material: Material) {
    try {
      await del.mutateAsync(material.id);
      toast.success('Материал удалён');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить материал');
    } finally {
      setDeleteTarget(null);
    }
  }

  if (!subjectId || Number.isNaN(subjectId)) {
    return (
      <div className="card p-8">
        <ErrorBlock message="Некорректный идентификатор предмета" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/ai-tests"
          className="mb-3 mr-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          К AI-тестам
        </Link>
        <Link
          to="/subjects"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
        >
          К предметам
        </Link>
        <h1 className="text-[34px] font-extrabold tracking-tight text-slate-900">
          Материалы
        </h1>
        <p className="mt-1 text-slate-500">
          {subject?.name ?? 'Предмет'} — учебные материалы для AI-тестов
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию, теме или файлу…"
          className="w-full max-w-xs"
        />
        <div className="ml-auto">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
            Загрузить материал
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка материалов…" />
        ) : isError ? (
          <ErrorBlock
            message={error instanceof ApiError ? error.message : 'Ошибка загрузки'}
            onRetry={refetch}
          />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<FileText className="h-7 w-7" />}
            title={data && data.length > 0 ? 'Ничего не найдено' : 'Пока нет материалов'}
            description={
              data && data.length > 0
                ? 'Измените поисковый запрос.'
                : 'Загрузите PDF, DOCX, PPTX или TXT — текст извлечётся автоматически.'
            }
            action={
              data && data.length === 0 ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                  Загрузить материал
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3.5">Название</th>
                <th className="px-6 py-3.5">Тема</th>
                <th className="px-6 py-3.5">Тип</th>
                <th className="px-6 py-3.5">Размер</th>
                <th className="px-6 py-3.5">Статус</th>
                <th className="px-6 py-3.5">Ученикам</th>
                <th className="px-6 py-3.5">Загружен</th>
                <th className="px-6 py-3.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((material) => (
                <tr key={material.id} className="group transition hover:bg-slate-50/70">
                  <td className="px-6 py-3.5">
                    <div>
                      <p className="font-semibold text-slate-800">{material.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{material.originalFilename}</p>
                      {material.status === 'EXTRACTION_FAILED' && material.errorMessage && (
                        <p className="mt-1 text-xs text-red-600">{material.errorMessage}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-600">{material.topic || '—'}</td>
                  <td className="px-6 py-3.5 text-sm font-medium text-slate-700">
                    {formatFileType(material.mimeType, material.originalFilename)}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-600">
                    {formatFileSize(material.fileSize)}
                  </td>
                  <td className="px-6 py-3.5">
                    <MaterialStatusBadge status={material.status} />
                  </td>
                  <td className="px-6 py-3.5">
                    {material.visibleToStudents ? (
                      <Badge tone="green">Да</Badge>
                    ) : (
                      <Badge tone="gray">Нет</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-500">
                    {formatDate(material.createdAt)}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {material.status === 'EXTRACTION_FAILED' && (
                        <button
                          onClick={() => handleRetry(material)}
                          title="Повторить извлечение"
                          disabled={retry.isPending}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(material)}
                        disabled={downloadingId === material.id}
                        title="Скачать"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(material)}
                        title="Редактировать"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(material)}
                        title="Удалить"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isSuccess && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            1–{filtered.length} из {filtered.length}{' '}
            {pluralRu(filtered.length, ['материала', 'материалов', 'материалов'])}
          </div>
        )}
      </div>

      <MaterialUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        subjectId={subjectId}
      />

      <MaterialFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        subjectId={subjectId}
        material={editing}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Удалить материал?"
        confirmLabel="Удалить"
        danger
        loading={del.isPending}
        message={
          <>
            Материал <b>«{deleteTarget?.title}»</b> будет скрыт из списка. Файл в хранилище
            останется.
          </>
        }
      />
    </div>
  );
}
