import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award, BookOpen, BookText, CalendarCheck2, ChevronRight, FileText, Folder,
  ListChecks, NotebookPen, Plus, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { WorkspaceSectionCard } from '@/components/ui/WorkspaceSectionCard';
import { useTeacherWorkspaceHome, useTeacherWorkspaceSearch } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { openWorkspaceDocument } from '@/lib/teacherWorkspaceOpen';
import type { WorkspaceMaterialType, WorkspaceSearchItem, WorkspaceFileType } from '@/lib/teacherWorkspaceApi';
import { CreateFolderModal } from './CreateFolderModal';

const sectionPresentation = {
  ACHIEVEMENTS: { description: 'Медали и грамоты', tone: 'orange', icon: Award },
  TEXTBOOKS: { description: 'Личная библиотека учебников', tone: 'navy', icon: BookText },
  CURRICULUM_PLANS: { description: 'Календарно-тематическое планирование', tone: 'teal', icon: CalendarCheck2 },
  PREPARED_LESSONS: { description: 'Заготовки и конспекты', tone: 'orange', icon: NotebookPen },
  TESTS: { description: 'Тесты и контрольные работы', tone: 'navy', icon: ListChecks },
  HOMEWORK: { description: 'Учёт домашних заданий', tone: 'teal', icon: BookOpen },
  DOCUMENTS: { description: 'Файлы и документы', tone: 'orange', icon: FileText },
} as const;

const typeLabels: Record<WorkspaceMaterialType, string> = {
  TEXTBOOK: 'Учебники',
  CURRICULUM_PLAN: 'КТП',
  PREPARED_LESSON: 'Подготовленные уроки',
  TEST: 'Тесты',
  HOMEWORK: 'Домашние задания',
  DOCUMENT: 'Документы и материалы',
};

function pluralMaterials(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const word = mod100 >= 11 && mod100 <= 14 ? 'материалов'
    : mod10 === 1 ? 'материал' : mod10 >= 2 && mod10 <= 4 ? 'материала' : 'материалов';
  return `${count} ${word}`;
}

function validPage(raw: string | null) {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function sourceLabel(item: WorkspaceSearchItem) {
  if (item.folders?.length) return item.folders.map((folder) => `папка «${folder.name}»`).join(', ');
  return `раздел «${item.type ? typeLabels[item.type] : 'Материалы'}»`;
}

function MaterialKind({ item }: { item: WorkspaceSearchItem }) {
  if (item.fileExtension) return <FileTypeBadge format={item.fileExtension} />;
  return <Badge tone="navy">{item.type ? typeLabels[item.type] : 'Материал'}</Badge>;
}

function Results({ items, total, page, onPage, onOpen }: {
  items: WorkspaceSearchItem[];
  total: number;
  page: number;
  onPage: (page: number) => void;
  onOpen: (item: WorkspaceSearchItem) => void;
}) {
  if (total === 0) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center">
        <EmptyBlock icon={<Search className="size-8" />} title="Ничего не найдено" description="Попробуйте изменить запрос или фильтр" />
      </div>
    );
  }

  return (
    <section aria-label="Результаты поиска" className="mt-8">
      <div className="mb-4 flex items-center justify-between text-slate-500">
        <h2 className="text-11 font-bold uppercase">Результаты поиска</h2>
        <span className="text-13">{pluralMaterials(total)}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)_11rem] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold text-slate-500">
            <span>Материал</span><span>Дата</span><span>Источник</span><span>Добавил</span>
          </div>
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onOpen(item)}
              className="grid w-full grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)_11rem] items-center gap-4 border-b border-slate-200 px-6 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-700"
            >
              <span className="flex min-w-0 items-center gap-3">
                <MaterialKind item={item} />
                <span className="truncate font-semibold text-slate-900">{item.title}</span>
              </span>
              <span className="text-xs text-slate-500">{item.addedAt ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.addedAt)) : '—'}</span>
              <span className="min-w-0 truncate"><span className="rounded-md bg-slate-100 px-2 py-1 text-11 text-slate-500">{sourceLabel(item)}</span></span>
              <span className="truncate text-xs text-slate-700">{item.author || '—'}</span>
            </button>
          ))}
        </div>
      </div>
      {total > 20 && <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => onPage(page + 1)}>Далее</Button>
      </div>}
    </section>
  );
}

export function WorkspaceHomePage() {
  useDocumentTitle('Рабочее пространство');
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const typeValue = params.get('type') ?? '';
  const type = typeValue in typeLabels ? typeValue as WorkspaceMaterialType : undefined;
  const fileValue = params.get('fileType') ?? '';
  const fileType = ['PDF', 'WORD', 'SPREADSHEET', 'PRESENTATION', 'IMAGE'].includes(fileValue)
    ? fileValue as WorkspaceFileType : undefined;
  const folderPage = validPage(params.get('folderPage'));
  const searchPage = validPage(params.get('page'));
  const [input, setInput] = useState(q);
  const [creating, setCreating] = useState(false);
  const searchActive = Boolean(q.trim() || type || fileType);
  const home = useTeacherWorkspaceHome(folderPage);
  const search = useTeacherWorkspaceSearch({ q, type, fileType, page: searchPage }, searchActive);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (input === q) return;
    const timeout = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (input.trim()) next.set('q', input.trim()); else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [input, q, setParams]);

  function patch(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value); else next.delete(name);
      next.delete('page');
      return next;
    });
  }

  async function open(item: WorkspaceSearchItem) {
    if (item.sourceKind === 'teacher-homework' && item.sourceId) {
      navigate(`/homework/${item.sourceId}`);
      return;
    }
    if (item.sourceKind === 'teacher-textbook') {
      navigate(ROUTES.textbooks);
      return;
    }
    if (item.sourceKind === 'teacher-workspace-material') {
      try {
        await openWorkspaceDocument(item);
      } catch (caught) {
        toast.error(caught instanceof ApiError ? caught.message : 'Не удалось открыть материал');
      }
      return;
    }
    if (item.sectionCode) navigate(ROUTES.workspaceSection(item.sectionCode));
  }

  return (
    <div className="bg-white p-2 md:p-4">
      <h1 className="text-28 font-bold text-slate-900">Рабочее пространство</h1>
      <div className="mt-5 flex flex-col gap-4 md:flex-row">
        <SearchInput value={input} onChange={setInput} placeholder="Поиск по материалам" size="lg" className="min-w-0 flex-1" />
        <Select aria-label="Тип материала" value={type ?? ''} onChange={(event) => {
          const nextType = event.target.value;
          setParams((current) => {
            const next = new URLSearchParams(current);
            if (nextType) next.set('type', nextType); else next.delete('type');
            if (nextType !== 'DOCUMENT') next.delete('fileType');
            next.delete('page');
            return next;
          });
        }} className="h-12 w-full rounded-xl md:w-56">
          <option value="">Тип материала</option>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {type === 'DOCUMENT' && (
          <Select aria-label="Тип файла" value={fileType ?? ''} onChange={(event) => patch('fileType', event.target.value)} className="h-12 w-full rounded-xl md:w-40">
            <option value="">Все файлы</option>
            <option value="PDF">PDF</option><option value="WORD">DOC/DOCX</option>
            <option value="SPREADSHEET">XLS/XLSX</option><option value="PRESENTATION">PPT/PPTX</option>
            <option value="IMAGE">Изображения</option>
          </Select>
        )}
      </div>

      {searchActive ? (
        search.isPending ? <LoadingBlock /> : search.isError ? (
          <ErrorBlock message="Не удалось загрузить данные" onRetry={() => search.refetch()} />
        ) : <Results
          items={search.data?.items?.content ?? []}
          total={search.data?.items?.totalElements ?? 0}
          page={searchPage}
          onOpen={(item) => void open(item)}
          onPage={(page) => setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('page', String(page));
            return next;
          })}
        />
      ) : home.isPending ? <LoadingBlock /> : home.isError ? (
        <ErrorBlock message="Не удалось загрузить данные" onRetry={() => home.refetch()} />
      ) : (
        <>
          <section className="mt-8">
            <h2 className="mb-4 text-11 font-bold uppercase text-slate-500">Разделы</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {(home.data?.sections ?? []).map((section) => {
                const presentation = sectionPresentation[section.code as keyof typeof sectionPresentation];
                if (!section.code || !presentation) return null;
                const Icon = presentation.icon;
                return <WorkspaceSectionCard
                  key={section.code}
                  to={ROUTES.workspaceSection(section.code)}
                  title={section.title ?? section.code}
                  description={presentation.description}
                  tone={presentation.tone}
                  icon={<Icon className="size-8" strokeWidth={1.8} />}
                />;
              })}
            </div>
          </section>
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-11 font-bold uppercase text-slate-500">Мои папки</h2>
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Создать папку</Button>
            </div>
            {(home.data?.folders?.content ?? []).length === 0 ? (
              <EmptyBlock icon={<Folder className="size-7" />} title="Пока нет папок" />
            ) : (
              <div className="space-y-3">
                {home.data?.folders?.content?.map((folder) => folder.id != null && (
                  <Link key={folder.id} to={ROUTES.workspaceFolder(folder.id)} className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-navy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Folder className="size-5" /></span>
                    <span className="min-w-0 flex-1 truncate text-15 font-medium text-slate-900">{folder.name}</span>
                    <span className="text-sm text-slate-500">{pluralMaterials(folder.itemCount ?? 0)}</span>
                    <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
            {(home.data?.folders?.totalPages ?? 0) > 1 && <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" disabled={folderPage === 0} onClick={() => patch('folderPage', String(folderPage - 1))}>Назад</Button>
              <Button variant="secondary" size="sm" disabled={folderPage + 1 >= (home.data?.folders?.totalPages ?? 0)} onClick={() => patch('folderPage', String(folderPage + 1))}>Далее</Button>
            </div>}
          </section>
        </>
      )}
      <CreateFolderModal open={creating} onClose={() => setCreating(false)} onCreated={(folder) => {
        setCreating(false);
        if (folder.id != null) navigate(ROUTES.workspaceFolder(folder.id));
      }} />
    </div>
  );
}
