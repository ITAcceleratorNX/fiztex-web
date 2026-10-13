import { cx } from '@/lib/format';
import { ParentCommentIcon } from './ParentCommentIcon';

export function CommentButton({ published, studentName, onClick, disabled }: {
  published: boolean; studentName: string; onClick: () => void; disabled?: boolean;
}) {
  const label = `${published ? 'Комментарий родителю' : 'Добавить комментарий родителю'}: ${studentName}`;
  return <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
    className={cx('flex size-8 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:opacity-40',
      published ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300 bg-transparent text-slate-400 hover:border-navy-700 hover:text-navy-700')}>
    <ParentCommentIcon />
  </button>;
}
