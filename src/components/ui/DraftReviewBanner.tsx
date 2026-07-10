import type { ReactNode } from 'react';

export function DraftReviewBanner({
  draftCount,
  children,
}: {
  draftCount: number;
  children?: ReactNode;
}) {
  if (draftCount <= 0) return null;

  return (
    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
      <p className="font-semibold">
        {draftCount}{' '}
        {draftCount === 1
          ? 'сгенерированный вопрос ожидает проверки'
          : draftCount < 5
            ? 'сгенерированных вопроса ожидают проверки'
            : 'сгенерированных вопросов ожидают проверки'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">
        Проверьте формулировки, варианты и правильные ответы. Удалите некачественные вопросы при
        необходимости. После сохранения черновики станут доступны ученикам при прохождении теста.
      </p>
      {children}
    </div>
  );
}
