import type { WorkspaceMaterialType } from '@/lib/teacherWorkspaceApi';

export const materialTypeLabels: Record<WorkspaceMaterialType, string> = {
  TEXTBOOK: 'Учебник',
  CURRICULUM_PLAN: 'КТП',
  PREPARED_LESSON: 'Подготовленный урок',
  TEST: 'Тест',
  HOMEWORK: 'Домашнее задание',
  DOCUMENT: 'Документ или ссылка',
};
