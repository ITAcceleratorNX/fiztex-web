import type { Schema } from './apiSchemas';

export type FormulaProfile = NonNullable<Schema<'SchoolSubjectView'>['formulaProfile']>;
export const FORMULA_PROFILES: Record<FormulaProfile, string> = {
  GENERAL: 'Общие формулы', MATHEMATICS: 'Математика', PHYSICS: 'Физика', CHEMISTRY: 'Химия',
};
