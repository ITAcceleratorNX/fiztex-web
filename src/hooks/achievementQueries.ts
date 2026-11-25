import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  achievementsApi,
  type TeacherAchievement,
  type UpdateAchievementRequest,
  type UpdateVisibilityRequest,
  type UploadProgress,
} from '@/lib/achievementsApi';

const KEY = ['teacher-achievements'] as const;

export function useTeacherAchievements() {
  return useQuery({ queryKey: [...KEY, 'list'], queryFn: ({ signal }) => achievementsApi.list(signal) });
}

/** Аудитория — действующие классы учителя; сервер проверяет выбор по тем же назначениям. */
export function useAchievementAudienceOptions(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'audience'],
    enabled,
    queryFn: ({ signal }) => achievementsApi.audienceOptions(signal),
  });
}

/** Ответ записи кладётся в список точечно; удаление и ошибки перечитывают список целиком. */
function useAchievementWrite<V>(write: (variables: V) => Promise<TeacherAchievement>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: (saved) => {
      client.setQueryData<TeacherAchievement[]>([...KEY, 'list'], (list) => {
        if (!list) return list;
        return list.some((item) => item.id === saved.id)
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...list];
      });
    },
    onError: () => void client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateAchievement() {
  return useAchievementWrite((v: { file: File; fields: UpdateAchievementRequest; onProgress?: UploadProgress }) =>
    achievementsApi.create(v.file, v.fields, v.onProgress));
}

export function useUpdateAchievement() {
  return useAchievementWrite((v: { id: number; fields: UpdateAchievementRequest }) =>
    achievementsApi.update(v.id, v.fields));
}

export function useReplaceAchievementFile() {
  return useAchievementWrite((v: { id: number; file: File; onProgress?: UploadProgress }) =>
    achievementsApi.replaceFile(v.id, v.file, v.onProgress));
}

export function useUpdateAchievementVisibility() {
  return useAchievementWrite((v: { id: number; body: UpdateVisibilityRequest }) =>
    achievementsApi.updateVisibility(v.id, v.body));
}

export function useDeleteAchievement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => achievementsApi.remove(id),
    onSettled: () => void client.invalidateQueries({ queryKey: KEY }),
  });
}
