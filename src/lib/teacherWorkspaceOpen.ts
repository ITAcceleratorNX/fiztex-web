import { teacherWorkspaceApi, type WorkspaceSearchItem } from './teacherWorkspaceApi';

const inlineExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

/** Открывает личный DOCUMENT с повторной проверкой владельца на backend. */
export async function openWorkspaceDocument(item: WorkspaceSearchItem): Promise<void> {
  const id = Number(item.sourceId);
  if (item.sourceKind !== 'teacher-workspace-material' || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Материал недоступен');
  }

  // Вкладка создаётся синхронно с кликом: после ожидания API браузер блокирует pop-up.
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const material = await teacherWorkspaceApi.material(id);
    if (material.kind === 'EXTERNAL_LINK' && material.externalUrl) {
      const target = new URL(material.externalUrl);
      if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('Небезопасная ссылка');
      if (tab) tab.location.href = target.href;
      else window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }

    if (material.kind !== 'FILE') throw new Error('Материал недоступен');
    const blob = await teacherWorkspaceApi.materialContent(id);
    const objectUrl = URL.createObjectURL(blob);
    const extension = material.fileExtension?.toLowerCase() ?? '';
    if (inlineExtensions.has(extension)) {
      if (tab) tab.location.href = objectUrl;
      else window.open(objectUrl, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60_000);
      return;
    }

    tab?.close();
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = material.fileName || material.title || `Материал-${id}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
