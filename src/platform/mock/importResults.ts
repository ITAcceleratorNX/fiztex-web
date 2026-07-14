import type { AccessCodeRow, ImportEntityType, ImportResult } from '../types';

export const MOCK_IMPORT_BY_TYPE: Record<ImportEntityType, ImportResult> = {
  STUDENTS: {
    id: 'import-students',
    entityType: 'STUDENTS',
    fileName: 'students_2026.xlsx',
    importedAt: '2026-07-10T11:00:00Z',
    successCount: 18,
    warningCount: 2,
    errorCount: 3,
    rows: [
      { row: 2, entityLabel: 'Козлов Артём', severity: 'OK', message: 'Импортирован' },
      { row: 3, entityLabel: 'Нурланова Амина', severity: 'OK', message: 'Импортирован' },
      {
        row: 4,
        entityLabel: 'Иванов Иван',
        severity: 'WARNING',
        message: 'Телефон родителя отсутствует',
      },
      { row: 5, entityLabel: '', severity: 'ERROR', message: 'Пустое ФИО' },
      {
        row: 6,
        entityLabel: 'Дубликат Петров',
        severity: 'ERROR',
        message: 'Ученик с таким ФИО уже есть в классе 7А',
      },
      {
        row: 7,
        entityLabel: 'Смирнова Оля',
        severity: 'WARNING',
        message: 'Класс «7В» не найден — создан черновик',
      },
      {
        row: 8,
        entityLabel: 'Без даты',
        severity: 'ERROR',
        message: 'Неверный формат даты рождения',
      },
    ],
  },
  PARENTS: {
    id: 'import-parents',
    entityType: 'PARENTS',
    fileName: 'parents_2026.xlsx',
    importedAt: '2026-07-10T11:00:00Z',
    successCount: 10,
    warningCount: 1,
    errorCount: 2,
    rows: [
      { row: 2, entityLabel: 'Козлова Мария', severity: 'OK', message: 'Импортирован' },
      {
        row: 3,
        entityLabel: 'Нурланов Ерлан',
        severity: 'WARNING',
        message: 'Email отсутствует',
      },
      {
        row: 4,
        entityLabel: '',
        severity: 'ERROR',
        message: 'Неверный формат телефона',
      },
      {
        row: 5,
        entityLabel: 'Козлова Мария',
        severity: 'ERROR',
        message: 'Дубликат: телефон уже используется',
      },
    ],
  },
  TEACHERS: {
    id: 'import-teachers',
    entityType: 'TEACHERS',
    fileName: 'teachers_2026.xlsx',
    importedAt: '2026-07-10T11:00:00Z',
    successCount: 6,
    warningCount: 1,
    errorCount: 1,
    rows: [
      { row: 2, entityLabel: 'Петров Дмитрий', severity: 'OK', message: 'Импортирован' },
      {
        row: 3,
        entityLabel: 'Сидорова Елена',
        severity: 'WARNING',
        message: 'Предмет не указан',
      },
      {
        row: 4,
        entityLabel: 'Без email',
        severity: 'ERROR',
        message: 'У учителя обязателен email или телефон',
      },
    ],
  },
  CLASSES: {
    id: 'import-classes',
    entityType: 'CLASSES',
    fileName: 'classes_2026.xlsx',
    importedAt: '2026-07-10T11:00:00Z',
    successCount: 8,
    warningCount: 0,
    errorCount: 2,
    rows: [
      { row: 2, entityLabel: '7А', severity: 'OK', message: 'Импортирован' },
      { row: 3, entityLabel: '7Б', severity: 'OK', message: 'Импортирован' },
      {
        row: 4,
        entityLabel: '7А',
        severity: 'ERROR',
        message: 'Дубликат класса в учебном году 2026/2027',
      },
      {
        row: 5,
        entityLabel: '8Г',
        severity: 'ERROR',
        message: 'Учебный год не найден',
      },
    ],
  },
};

export function buildExportCsv(codes: AccessCodeRow[]): string {
  const header = 'fullName,role,codeHint,status,issuedAt,usedAt';
  const lines = codes.map((code) =>
    [
      csvEscape(code.userFullName),
      code.role,
      code.codeHint,
      code.status,
      code.issuedAt,
      code.usedAt ?? '',
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
