import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useToast } from '@/context/ToastContext';
import { useRefreshFeedbackSheet, useSaveFeedbackEntry } from '@/hooks/queries';
import { FeedbackDraft, type DraftState } from '@/lib/feedbackDraft';
import type { FeedbackSheetKey, FeedbackStudentRow } from '@/lib/monthlyFeedbackApi';

/**
 * Черновик отзыва открытого ученика поверх {@link FeedbackDraft}.
 *
 * <p>Черновик заводится на ученика, а не на окно: «Следующий ученик» меняет его, не закрывая
 * окна. Старый при этом досохраняется в фоне — его поздний ответ перерисовывает экран, но
 * показывается всегда состояние текущего (`draft.state`), так что чужой ответ поле не
 * перепишет.
 *
 * <p>Текст записи читается один раз при открытии: кэш листа меняется от наших же сохранений,
 * и пересоздавать черновик на каждое из них значило бы сбрасывать набор.
 */
export function useFeedbackDraft(
  sheetKey: FeedbackSheetKey,
  student: FeedbackStudentRow,
): { draft: FeedbackDraft; state: DraftState } {
  const toast = useToast();
  const refresh = useRefreshFeedbackSheet();
  const saveEntry = useSaveFeedbackEntry(sheetKey);
  const saveRef = useRef(saveEntry.mutateAsync);
  saveRef.current = saveEntry.mutateAsync;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const studentProfileId = student.studentProfileId as number;
  const draft = useMemo(
    () =>
      new FeedbackDraft({
        initial: student.entry,
        save: (body) => saveRef.current({ studentProfileId, ...body }),
        onChange: rerender,
        onLocked: (error) => {
          toast.error(error.message);
          void refresh(sheetKey);
        },
        onResync: () => void refresh(sheetKey),
      }),
    // Черновик — на ученика; запись и координаты листа читаются при его создании.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studentProfileId, sheetKey.month, sheetKey.classId, sheetKey.subjectId],
  );

  // Уход из окна или со страницы — немедленное сохранение (контракт T4). Ответ придёт уже без
  // окна, но кэш листа обновит сама мутация.
  useEffect(
    () => () => {
      void draft.flush();
      draft.dispose();
    },
    [draft],
  );

  return { draft, state: draft.state };
}
