import { MOCK_IMPORT_BY_TYPE } from '../mock/importResults';
import type { ImportEntityType, ImportResult } from '../types';
import { mockDelay } from './delay';

export async function getLatestImportResult(
  entityType: ImportEntityType = 'STUDENTS',
): Promise<ImportResult | null> {
  await mockDelay();
  const base = MOCK_IMPORT_BY_TYPE[entityType];
  return { ...base, rows: [...base.rows] };
}

/**
 * @deprecated Mock Excel import (PHYCORE-003 fixture). Real flow: ImportPage + importApi.ts.
 * Kept only for reference; do not wire into UI.
 */
export async function runMockImport(
  entityType: ImportEntityType,
  file: File,
): Promise<ImportResult> {
  await mockDelay(600);
  const name = file.name.toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(name)) {
    throw new Error('Поддерживаются только файлы .xlsx, .xls или .csv');
  }
  if (file.size === 0) {
    throw new Error('Файл пустой');
  }

  const base = MOCK_IMPORT_BY_TYPE[entityType];
  return {
    ...base,
    id: `import-${Date.now()}`,
    fileName: file.name,
    importedAt: new Date().toISOString(),
    rows: [...base.rows],
  };
}
