import { request, requestBlob, requestMultipart } from './api';
import type { Schema } from './apiSchemas';

export type Workspace = Schema<'WorkspaceView'>;
export type WorkspaceFolder = Schema<'WorkspaceFolderView'>;
export type WorkspaceFolderContent = Schema<'WorkspaceFolderContentView'>;
export type WorkspaceSectionContent = Schema<'WorkspaceSectionContentView'>;
export type WorkspaceSearch = Schema<'WorkspaceSearchView'>;
export type WorkspaceSearchItem = Schema<'WorkspaceSearchItemView'>;
export type WorkspaceMaterial = Schema<'TeacherWorkspaceMaterialView'>;
export type WorkspaceDependencies = Schema<'TeacherWorkspaceDependenciesView'>;
export type WorkspaceMaterialType = NonNullable<WorkspaceSearchItem['type']>;
export type WorkspaceFileType = 'PDF' | 'WORD' | 'SPREADSHEET' | 'PRESENTATION' | 'IMAGE';
export type WorkspaceSearchQuery = {
  q?: string;
  type?: WorkspaceMaterialType;
  fileType?: WorkspaceFileType;
  folderId?: number;
  page?: number;
};

const root = '/teacher/workspace';

function pageParams(page: number, size = 20): string {
  return new URLSearchParams({ page: String(page), size: String(size) }).toString();
}

export const teacherWorkspaceApi = {
  home: (page = 0, signal?: AbortSignal) =>
    request<Workspace>(`${root}?${pageParams(page)}`, { signal }),
  folders: (page = 0, signal?: AbortSignal) =>
    request<Schema<'PageWorkspaceFolderView'>>(`${root}/folders?${pageParams(page)}`, { signal }),
  folder: (folderId: number, page = 0, signal?: AbortSignal) =>
    request<WorkspaceFolderContent>(`${root}/folders/${folderId}/items?${pageParams(page)}`, { signal }),
  section: (code: string, page = 0, signal?: AbortSignal) =>
    request<WorkspaceSectionContent>(`${root}/sections/${encodeURIComponent(code)}/items?${pageParams(page)}`, { signal }),
  search: (query: WorkspaceSearchQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams(pageParams(query.page ?? 0));
    if (query.q?.trim()) params.set('q', query.q.trim());
    if (query.type) params.set('type', query.type);
    if (query.fileType) params.set('fileType', query.fileType);
    if (query.folderId) params.set('folderId', String(query.folderId));
    return request<WorkspaceSearch>(`${root}/search?${params}`, { signal });
  },
  createFolder: (name: string) =>
    request<WorkspaceFolder>(`${root}/folders`, { method: 'POST', body: { name } }),
  renameFolder: (folderId: number, name: string) =>
    request<WorkspaceFolder>(`${root}/folders/${folderId}`, { method: 'PATCH', body: { name } }),
  deleteFolder: (folderId: number) =>
    request<void>(`${root}/folders/${folderId}`, { method: 'DELETE' }),
  attachToFolder: (folderId: number, itemId: number) =>
    request<void>(`${root}/folders/${folderId}/items/${itemId}`, { method: 'PUT' }),
  detachFromFolder: (folderId: number, itemId: number) =>
    request<void>(`${root}/folders/${folderId}/items/${itemId}`, { method: 'DELETE' }),
  material: (id: number, signal?: AbortSignal) =>
    request<WorkspaceMaterial>(`${root}/materials/${id}`, { signal }),
  renameMaterial: (id: number, body: Schema<'RenameTeacherWorkspaceMaterialRequest'>) =>
    request<WorkspaceMaterial>(`${root}/materials/${id}`, { method: 'PATCH', body }),
  materialDependencies: (id: number, signal?: AbortSignal) =>
    request<WorkspaceDependencies>(`${root}/materials/${id}/dependencies`, { signal }),
  deleteMaterial: (id: number, revision: string) =>
    request<void>(`${root}/materials/${id}`, { method: 'DELETE', headers: { 'If-Match': revision } }),
  materialContent: (id: number, signal?: AbortSignal) =>
    requestBlob(`${root}/materials/${id}/content`, signal),
  materials: (page = 0, signal?: AbortSignal) =>
    request<Schema<'PageTeacherWorkspaceMaterialView'>>(`${root}/materials?${pageParams(page)}`, { signal }),
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestMultipart<WorkspaceMaterial>(`${root}/materials/files`, form);
  },
  createLink: (body: Schema<'CreateTeacherWorkspaceLinkRequest'>) =>
    request<WorkspaceMaterial>(`${root}/materials/links`, { method: 'POST', body }),
  attachDocumentToHomework: (homeworkId: number, workspaceItemId: number) =>
    request<Schema<'HomeworkMaterialView'>>(`/homework/${homeworkId}/materials/workspace-items/${workspaceItemId}`, { method: 'POST' }),
  attachDocumentToLesson: (lessonId: number, workspaceItemId: number, visibleToStudents = true) =>
    request<Schema<'LessonMaterialView'>>(`/lessons/${lessonId}/materials/workspace-items/${workspaceItemId}?visibleToStudents=${visibleToStudents}`, { method: 'POST' }),
};
