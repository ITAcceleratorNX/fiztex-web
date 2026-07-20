// Types mirror backend schedule-2B DTOs (feat/schedule-2b).

import type { Weekday } from '@/lib/scheduleSettingsTypes';

export type TeacherAvailabilityStatus = 'APPROVED' | 'INACTIVE';

export type PreferredShift = 'FIRST' | 'SECOND';

export type TeacherTimeType = 'AVAILABLE' | 'UNAVAILABLE';

export type SchoolRecordStatus = 'ACTIVE' | 'ARCHIVED';

export type TeacherRef = {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityInterval = {
  id: number;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  type: TeacherTimeType;
};

export type TeacherAvailability = {
  teacherId: number;
  exists: boolean;
  workingDays: Weekday[];
  preferredShift: PreferredShift | null;
  status: TeacherAvailabilityStatus;
  approvedBy: number | null;
  approvedAt: string | null;
  version: number | null;
  intervals: AvailabilityInterval[];
};

export type PutAvailabilityIntervalRequest = {
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  type: TeacherTimeType;
};

export type PutAvailabilityRequest = {
  workingDays: Weekday[];
  preferredShift?: PreferredShift | null;
  intervals: PutAvailabilityIntervalRequest[];
  version?: number | null;
};

export type SubjectRef = {
  id: number;
  name: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type GroupSet = {
  id: number;
  academicYearId: number;
  classId: number;
  academicPeriodId: number | null;
  subjectId: number | null;
  name: string;
  status: SchoolRecordStatus;
  subgroupCount: number;
  assignedStudentCount: number;
  /** Class members not yet in any active subgroup of this set. */
  unassignedStudentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateGroupSetRequest = {
  classId: number;
  academicPeriodId?: number | null;
  subjectId?: number | null;
  name: string;
};

export type PatchGroupSetRequest = {
  name?: string | null;
  academicPeriodId?: number | null;
  clearAcademicPeriod?: boolean | null;
  subjectId?: number | null;
  clearSubject?: boolean | null;
};

export type AutoSplitRequest = {
  firstName?: string | null;
  secondName?: string | null;
};

export type GroupSetRef = {
  id: number;
  name: string;
  subjectId: number | null;
  academicPeriodId: number | null;
};

export type SubgroupStudent = {
  id: number | null;
  subgroupId: number | null;
  studentId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
};

export type Subgroup = {
  id: number;
  academicYearId: number;
  classId: number;
  groupSetId: number;
  groupSet: GroupSetRef | null;
  name: string;
  status: SchoolRecordStatus;
  students: SubgroupStudent[];
  createdAt: string;
  updatedAt: string;
};

export type CreateSubgroupRequest = {
  groupSetId: number;
  name: string;
};

export type UpdateSubgroupRequest = {
  name?: string | null;
};

export type AddSubgroupStudentsRequest = {
  studentIds: number[];
};

export type MoveStudentRequest = {
  targetSubgroupId: number;
};

export type DuplicateStudent = {
  studentId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  subgroupIds: number[];
};

export type IntegrityInfo = {
  unassignedStudents: SubgroupStudent[];
  duplicates: DuplicateStudent[];
};

export type GroupSetAggregate = {
  groupSet: GroupSet;
  subgroups: Subgroup[];
  unassignedStudents: SubgroupStudent[];
  duplicates: DuplicateStudent[];
};

export type StudentAlreadyInSetSubgroup = {
  studentId: number;
  subgroupId: number;
  subgroupName: string;
};

export type SubgroupInUse = {
  subgroupId: number;
  name: string;
  lessonCount: number;
};
