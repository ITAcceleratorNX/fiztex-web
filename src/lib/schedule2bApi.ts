import { ApiError, pageQuery, request } from '@/lib/api';
import type {
  AutoSplitRequest,
  GroupSet,
  GroupSetAggregate,
  PutAvailabilityRequest,
  Subgroup,
  SubgroupStudent,
  TeacherAvailability,
} from '@/lib/schedule2bTypes';

export function isVersionConflict(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'AVAILABILITY_VERSION_CONFLICT'
  );
}

export function isStudentAlreadyInSet(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'STUDENT_ALREADY_IN_SET_SUBGROUP'
  );
}

export function isSubgroupsInUse(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'SUBGROUPS_IN_USE'
  );
}

export function isGroupSetNotEmpty(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'GROUP_SET_NOT_EMPTY'
  );
}

export const teacherAvailabilityApi = {
  get: (teacherId: number, signal?: AbortSignal) =>
    request<TeacherAvailability>(`/admin/teachers/${teacherId}/availability`, { signal }),

  put: (teacherId: number, body: PutAvailabilityRequest) =>
    request<TeacherAvailability>(`/admin/teachers/${teacherId}/availability`, {
      method: 'PUT',
      body,
    }),
};

export type GroupSetListFilters = {
  classId: number;
  status?: string | null;
  subjectId?: number | null;
  academicPeriodId?: number | null;
};

export const subgroupsApi = {
  listGroupSets: (filters: GroupSetListFilters, signal?: AbortSignal) =>
    request<GroupSet[]>(
      `/admin/group-sets${pageQuery({
        classId: filters.classId,
        status: filters.status,
        subjectId: filters.subjectId,
        academicPeriodId: filters.academicPeriodId,
      })}`,
      { signal },
    ),

  getGroupSet: (id: number, signal?: AbortSignal) =>
    request<GroupSetAggregate>(`/admin/group-sets/${id}`, { signal }),

  createGroupSet: (body: {
    classId: number;
    academicPeriodId?: number | null;
    subjectId?: number | null;
    name: string;
  }) => request<GroupSet>('/admin/group-sets', { method: 'POST', body }),

  patchGroupSet: (
    id: number,
    body: {
      name?: string | null;
      academicPeriodId?: number | null;
      clearAcademicPeriod?: boolean | null;
      subjectId?: number | null;
      clearSubject?: boolean | null;
    },
  ) => request<GroupSet>(`/admin/group-sets/${id}`, { method: 'PATCH', body }),

  archiveGroupSet: (id: number, confirmImpact = false) =>
    request<void>(`/admin/group-sets/${id}/archive${pageQuery({ confirmImpact })}`, {
      method: 'POST',
    }),

  autoSplit: (id: number, body?: AutoSplitRequest) =>
    request<GroupSetAggregate>(`/admin/group-sets/${id}/auto-split`, {
      method: 'POST',
      body: body ?? {},
    }),

  unassignedStudents: (id: number, signal?: AbortSignal) =>
    request<SubgroupStudent[]>(`/admin/group-sets/${id}/unassigned-students`, { signal }),

  createSubgroup: (body: { groupSetId: number; name: string }) =>
    request<Subgroup>('/admin/subgroups', { method: 'POST', body }),

  patchSubgroup: (id: number, body: { name?: string | null }) =>
    request<Subgroup>(`/admin/subgroups/${id}`, { method: 'PATCH', body }),

  archiveSubgroup: (id: number, confirmImpact = false) =>
    request<void>(`/admin/subgroups/${id}/archive${pageQuery({ confirmImpact })}`, {
      method: 'POST',
    }),

  addStudents: (subgroupId: number, studentIds: number[]) =>
    request<SubgroupStudent[]>(`/admin/subgroups/${subgroupId}/students`, {
      method: 'POST',
      body: { studentIds },
    }),

  removeStudent: (subgroupId: number, studentId: number) =>
    request<void>(`/admin/subgroups/${subgroupId}/students/${studentId}`, {
      method: 'DELETE',
    }),

  moveStudent: (subgroupId: number, studentId: number, targetSubgroupId: number) =>
    request<SubgroupStudent>(`/admin/subgroups/${subgroupId}/students/${studentId}/move`, {
      method: 'POST',
      body: { targetSubgroupId },
    }),
};
