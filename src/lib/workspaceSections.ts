export const workspaceSectionLabels = {
  ACHIEVEMENTS: 'Достижения',
  TEXTBOOKS: 'Учебники',
  CURRICULUM_PLANS: 'КТП',
  PREPARED_LESSONS: 'Подготовленные уроки',
  TESTS: 'Тесты',
  HOMEWORK: 'Домашние задания',
  DOCUMENTS: 'Документы и материалы',
} as const;

export function workspaceSectionLabel(path: string): string | null {
  const code = /^\/workspace\/sections\/([A-Z_]+)$/.exec(path.split('?')[0])?.[1];
  return code && code in workspaceSectionLabels
    ? workspaceSectionLabels[code as keyof typeof workspaceSectionLabels]
    : null;
}
