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
 * Mock Excel import: validates extension client-side, returns fixture result for the type.
 * Real parsing is out of scope (PHYCORE-003).
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
