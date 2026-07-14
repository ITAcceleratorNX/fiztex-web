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
