// Platform Core Lite types — aligned with backend enums (PHYCORE-001 / PHYCORE-002)
// so the mock layer can be swapped for real API responses later.

export type AccountRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type AccountStatus = 'NOT_ACTIVATED' | 'ACTIVE' | 'BLOCKED' | 'ARCHIVED';

export type SchoolRecordStatus = 'ACTIVE' | 'ARCHIVED';

export type AcademicYearStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type AcademicPeriodStatus = 'ACTIVE' | 'DISABLED' | 'ARCHIVED';

export type AcademicPeriodType = 'QUARTER' | 'TRIMESTER' | 'SEMESTER' | 'CUSTOM';

export type CredentialStatus = 'ACTIVE' | 'USED' | 'REPLACED' | 'BLOCKED' | 'EXPIRED';

export type ImportEntityType = 'STUDENTS' | 'PARENTS' | 'TEACHERS' | 'CLASSES';

export type ImportRowSeverity = 'ERROR' | 'WARNING' | 'OK';

export interface PlatformUser {
  id: string;
  fullName: string;
  role: AccountRole;
  email: string | null;
  phone: string | null;
  status: AccountStatus;
  /** e.g. class name for student, children names for parent */
  relationLabel: string | null;
  createdAt: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  academicYearId: string;
  academicYearName: string;
  studentCount: number;
  status: SchoolRecordStatus;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  createdAt: string;
}

export interface AcademicPeriod {
  id: string;
  academicYearId: string;
  name: string;
  type: AcademicPeriodType;
  startDate: string;
  endDate: string;
  status: AcademicPeriodStatus;
}

export interface AccessCodeRow {
  id: string;
  userId: string;
  userFullName: string;
  role: AccountRole;
  codeHint: string;
  status: CredentialStatus;
  issuedAt: string;
  usedAt: string | null;
}

export interface ImportResultRow {
  row: number;
  entityLabel: string;
  severity: ImportRowSeverity;
  message: string;
}

export interface ImportResult {
  id: string;
  entityType: ImportEntityType;
  fileName: string;
  importedAt: string;
  successCount: number;
  warningCount: number;
  errorCount: number;
  rows: ImportResultRow[];
}

export interface ListUsersParams {
  query?: string;
  role?: AccountRole | 'ALL';
  status?: AccountStatus | 'ALL';
}

export interface ListClassesParams {
  academicYearId?: string | 'ALL';
}

export interface CreateUserInput {
  fullName: string;
  role: AccountRole;
  email?: string | null;
  phone?: string | null;
  status?: AccountStatus;
  relationLabel?: string | null;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  status?: AccountStatus;
  relationLabel?: string | null;
}

export interface CreateClassInput {
  name: string;
  academicYearId: string;
  grade: string;
  letter: string;
  status?: SchoolRecordStatus;
}

export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: AcademicYearStatus;
}

export interface UpdateAcademicYearInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: AcademicYearStatus;
}

export interface CreatePeriodInput {
  academicYearId: string;
  name: string;
  type: AcademicPeriodType;
  startDate: string;
  endDate: string;
  status?: AcademicPeriodStatus;
}

export interface UpdatePeriodInput {
  name?: string;
  type?: AcademicPeriodType;
  startDate?: string;
  endDate?: string;
  status?: AcademicPeriodStatus;
}

// --- School structure (students / parents / teachers) ---

export type StudentProfileStatus = 'ACTIVE' | 'ARCHIVED';

export type ParentRelationType = 'MOTHER' | 'FATHER' | 'GUARDIAN' | 'OTHER';

export type ImportType =
  | 'CLASSES'
  | 'STUDENTS'
  | 'STUDENTS_WITH_PARENTS'
  | 'PARENTS'
  | 'TEACHERS';

export type ImportRunStatus =
  | 'UPLOADED'
  | 'ANALYZING'
  | 'PREVIEW_READY'
  | 'ANALYSIS_FAILED'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export type ImportDuplicateStrategy = 'SKIP' | 'UPDATE';

export interface ClassMembership {
  id: number;
  academicYearId: number;
  academicYearName: string;
  classId: number;
  className: string;
  status: SchoolRecordStatus;
  createdAt: string;
}

export interface StudentProfile {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  status: StudentProfileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileDetail extends StudentProfile {
  currentMembership: ClassMembership | null;
  membershipHistory: ClassMembership[];
}

export interface ParentProfile {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedStudent {
  studentProfileId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  relationType: ParentRelationType;
  linkStatus: SchoolRecordStatus;
}

export interface ParentProfileDetail extends ParentProfile {
  linkedStudents: LinkedStudent[];
}

export interface TeacherProfile {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignment {
  id: number;
  teacherProfileId: number;
  teacherName: string;
  schoolSubjectId: number;
  schoolSubjectName: string;
  classId: number;
  className: string;
  academicYearId: number;
  academicYearName: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherProfileDetail extends TeacherProfile {
  assignments: TeacherAssignment[];
}

export interface SchoolSubject {
  id: number;
  name: string;
  status: SchoolRecordStatus;
}

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
}

export interface ImportTypeInfo {
  type: ImportType;
  label: string;
  fields: ImportFieldDef[];
}

export interface ImportRunUploader {
  id: number;
  fullName: string;
  email: string | null;
}

export interface ImportRun {
  id: number;
  importType: ImportType;
  importTypeLabel: string;
  status: ImportRunStatus;
  fileName: string;
  uploadedBy: ImportRunUploader | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalRows: number | null;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
}

export interface ImportRunDetail extends ImportRun {
  columnNames: string[];
  mapping: Record<string, string> | null;
  duplicateStrategy: ImportDuplicateStrategy | null;
  errorMessage: string | null;
  updatedAt: string | null;
}

export interface ImportRunError {
  rowNumber: number;
  field: string | null;
  errorCode: string;
  message: string;
  rawRow: string | null;
}

export function formatPersonName(
  lastName: string,
  firstName: string,
  middleName?: string | null,
): string {
  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}
