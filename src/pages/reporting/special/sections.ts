import type { SpecialForm } from '@/hooks/specialReportQueries';
import { FORM_TITLES } from '@/lib/specialReportModel';

/**
 * Разделы «Отчётности»: прежние «Показатели / Рейтинг / Динамика» и три специальные формы
 * (ТЗ «Специальные формы учебной отчётности» §6). Раздел живёт в адресе (`section` у
 * администратора и учителя, `reportSection` у классного руководителя).
 */
export type Section = 'metrics' | 'rating' | 'dynamics' | SpecialForm;

export const SECTION_OPTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: 'metrics', label: 'Показатели' },
  { value: 'rating', label: 'Рейтинг' },
  { value: 'dynamics', label: 'Динамика' },
  { value: 'classPerformance', label: FORM_TITLES.classPerformance },
  { value: 'teacherPerformance', label: FORM_TITLES.teacherPerformance },
  { value: 'assessment', label: FORM_TITLES.assessment },
];

export function isSpecialSection(section: string | null | undefined): section is SpecialForm {
  return section === 'assessment' || section === 'classPerformance' || section === 'teacherPerformance';
}
