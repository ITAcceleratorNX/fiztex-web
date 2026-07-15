import { useCallback, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { platformCoreApi } from '@/lib/platformCoreApi';
import {
  isConfirmableScheduleSettingsError,
  scheduleSettingsApi,
} from '@/lib/scheduleSettingsApi';
import type {
  BindBellTemplateRequest,
  CalendarEventFilters,
  CopyBellTemplateRequest,
  CreateBellTemplateRequest,
  CreateCalendarEventRequest,
  CreateLessonPeriodRequest,
  ScheduleSettingsEntityType,
  UpdateBellTemplateRequest,
  UpdateCalendarEventRequest,
  UpdateLessonPeriodRequest,
  UpdateWorkingDaysRequest,
} from '@/lib/scheduleSettingsTypes';

export const scheduleSettingsKeys = {
  years: ['academic-years'] as const,
  classes: (yearId: number) => ['school-classes', yearId] as const,
  bellTemplates: (yearId: number) => ['bell-templates', yearId] as const,
  bellTemplate: (id: number) => ['bell-template', id] as const,
  templateUsage: (id: number) => ['template-usage', id] as const,
  templateBindings: (id: number) => ['template-bindings', id] as const,
  workingDays: (yearId: number) => ['working-days', yearId] as const,
  calendarEvents: (yearId: number, filters: CalendarEventFilters) =>
    ['calendar-events', yearId, filters] as const,
  settingsHistory: (entityType: ScheduleSettingsEntityType, entityId: number) =>
    ['settings-history', entityType, entityId] as const,
};

export function useAcademicYears() {
  return useQuery({
    queryKey: scheduleSettingsKeys.years,
    queryFn: ({ signal }) => platformCoreApi.listAcademicYears(signal),
  });
}

export function useSchoolClasses(yearId: number | null) {
  return useQuery({
    queryKey: scheduleSettingsKeys.classes(yearId ?? 0),
    queryFn: ({ signal }) => platformCoreApi.listClasses(yearId!, signal),
    enabled: yearId != null && yearId > 0,
  });
}

export function useBellTemplates(yearId: number | null) {
  return useQuery({
    queryKey: scheduleSettingsKeys.bellTemplates(yearId ?? 0),
    queryFn: ({ signal }) => scheduleSettingsApi.listBellTemplates(yearId!, signal),
    enabled: yearId != null && yearId > 0,
  });
}

export function useBellTemplate(id: number | null) {
  return useQuery({
    queryKey: scheduleSettingsKeys.bellTemplate(id ?? 0),
    queryFn: ({ signal }) => scheduleSettingsApi.getBellTemplate(id!, signal),
    enabled: id != null && id > 0,
  });
}

export function useTemplateUsage(id: number | null) {
  return useQuery({
    queryKey: scheduleSettingsKeys.templateUsage(id ?? 0),
    queryFn: ({ signal }) => scheduleSettingsApi.getTemplateUsage(id!, signal),
    enabled: id != null && id > 0,
  });
}

export function useTemplateBindings(id: number | null) {
  return useQuery({
    queryKey: scheduleSettingsKeys.templateBindings(id ?? 0),
    queryFn: ({ signal }) => scheduleSettingsApi.listBindings(id!, signal),
    enabled: id != null && id > 0,
  });
}

export function useWorkingDays(yearId: number | null) {
  return useQuery({
    queryKey: scheduleSettingsKeys.workingDays(yearId ?? 0),
    queryFn: ({ signal }) => scheduleSettingsApi.getWorkingDays(yearId!, signal),
    enabled: yearId != null && yearId > 0,
  });
}

export function useCalendarEvents(yearId: number | null, filters: CalendarEventFilters = {}) {
  return useQuery({
    queryKey: scheduleSettingsKeys.calendarEvents(yearId ?? 0, filters),
    queryFn: ({ signal }) => scheduleSettingsApi.listCalendarEvents(yearId!, filters, signal),
    enabled: yearId != null && yearId > 0,
  });
}

export function useSettingsHistory(
  entityType: ScheduleSettingsEntityType | null,
  entityId: number | null,
) {
  return useQuery({
    queryKey: scheduleSettingsKeys.settingsHistory(entityType ?? 'BELL_TEMPLATE', entityId ?? 0),
    queryFn: ({ signal }) =>
      scheduleSettingsApi.listSettingsHistory(entityType!, entityId!, 0, 20, signal),
    enabled: entityType != null && entityId != null && entityId > 0,
  });
}

export type ConfirmableMutationResult<TData, TVariables> = UseMutationResult<
  TData,
  Error,
  TVariables
> & {
  confirmation: { variables: TVariables; error: ApiError } | null;
  confirm: () => Promise<TData | undefined>;
  dismissConfirmation: () => void;
};

/**
 * Wraps a mutation that may return a typed 409 requiring confirmImpact.
 * `withConfirmImpact` maps variables to a retry payload with confirmImpact: true.
 */
export function useConfirmableMutation<TData, TVariables>(
  options: UseMutationOptions<TData, Error, TVariables> & {
    withConfirmImpact: (variables: TVariables) => TVariables;
    isConfirmableConflict?: (error: unknown) => boolean;
  },
): ConfirmableMutationResult<TData, TVariables> {
  const {
    isConfirmableConflict = isConfirmableScheduleSettingsError,
    withConfirmImpact,
    onError,
    onSuccess,
    ...rest
  } = options;
  const [confirmation, setConfirmation] = useState<{
    variables: TVariables;
    error: ApiError;
  } | null>(null);

  const mutation = useMutation<TData, Error, TVariables>({
    ...rest,
    onError: (error, variables, onMutateResult, context) => {
      if (isConfirmableConflict(error) && error instanceof ApiError) {
        setConfirmation({ variables, error });
        return;
      }
      onError?.(error, variables, onMutateResult, context);
    },
    onSuccess: (...args) => {
      setConfirmation(null);
      onSuccess?.(...args);
    },
  });

  const dismissConfirmation = useCallback(() => setConfirmation(null), []);

  const confirm = useCallback(async () => {
    if (!confirmation) return undefined;
    const variables = withConfirmImpact(confirmation.variables);
    // Keep confirmation until onSuccess — if retry fails (5xx/network), dialog+details stay.
    return mutation.mutateAsync(variables);
  }, [confirmation, mutation, withConfirmImpact]);

  return {
    ...mutation,
    confirmation,
    confirm,
    dismissConfirmation,
  };
}

export function useCreateBellTemplate(yearId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBellTemplateRequest) => scheduleSettingsApi.createBellTemplate(body),
    onSuccess: () => {
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      }
    },
  });
}

type UpdateTemplateVars = UpdateBellTemplateRequest & { id: number };

export function useUpdateBellTemplate(yearId: number | null) {
  const qc = useQueryClient();
  return useConfirmableMutation({
    mutationFn: ({ id, ...body }: UpdateTemplateVars) =>
      scheduleSettingsApi.updateBellTemplate(id, body),
    withConfirmImpact: (vars) => ({ ...vars, confirmImpact: true }),
    onSuccess: (data) => {
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      }
      void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplate(data.id) });
      void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.templateUsage(data.id) });
    },
  });
}

export function useCopyBellTemplate(yearId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body?: CopyBellTemplateRequest }) =>
      scheduleSettingsApi.copyBellTemplate(id, body),
    onSuccess: () => {
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      }
    },
  });
}

type UpdatePeriodVars = UpdateLessonPeriodRequest & { periodId: number };

export function useUpdateLessonPeriod(templateId: number | null, yearId: number | null) {
  const qc = useQueryClient();
  return useConfirmableMutation({
    mutationFn: ({ periodId, ...body }: UpdatePeriodVars) => {
      if (templateId == null) throw new Error('templateId required');
      return scheduleSettingsApi.updatePeriod(templateId, periodId, body);
    },
    withConfirmImpact: (vars) => ({ ...vars, confirmImpact: true }),
    onSuccess: () => {
      if (templateId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplate(templateId) });
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.templateUsage(templateId) });
      }
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      }
    },
  });
}

export function useAddLessonPeriod(templateId: number | null, yearId: number | null) {
  const qc = useQueryClient();
  return useConfirmableMutation({
    mutationFn: (body: CreateLessonPeriodRequest) => {
      if (templateId == null) throw new Error('templateId required');
      return scheduleSettingsApi.addPeriod(templateId, body);
    },
    withConfirmImpact: (vars) => ({ ...vars, confirmImpact: true }),
    onSuccess: () => {
      if (templateId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplate(templateId) });
      }
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      }
    },
  });
}

export function useAssignBindings(templateId: number | null, yearId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BindBellTemplateRequest) => {
      if (templateId == null) throw new Error('templateId required');
      return scheduleSettingsApi.assignBindings(templateId, body);
    },
    onSuccess: () => {
      if (templateId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.templateBindings(templateId) });
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.templateUsage(templateId) });
      }
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      }
    },
  });
}

export function useUpdateWorkingDays(yearId: number | null) {
  const qc = useQueryClient();
  return useConfirmableMutation({
    mutationFn: (body: UpdateWorkingDaysRequest) => scheduleSettingsApi.updateWorkingDays(body),
    withConfirmImpact: (vars) => ({ ...vars, confirmImpact: true }),
    onSuccess: () => {
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: scheduleSettingsKeys.workingDays(yearId) });
      }
    },
  });
}

export function useCreateCalendarEvent(yearId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCalendarEventRequest) => scheduleSettingsApi.createCalendarEvent(body),
    onSuccess: () => {
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: ['calendar-events', yearId] });
      }
    },
  });
}

export function useUpdateCalendarEvent(yearId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateCalendarEventRequest }) =>
      scheduleSettingsApi.updateCalendarEvent(id, body),
    onSuccess: () => {
      if (yearId != null) {
        void qc.invalidateQueries({ queryKey: ['calendar-events', yearId] });
      }
    },
  });
}
