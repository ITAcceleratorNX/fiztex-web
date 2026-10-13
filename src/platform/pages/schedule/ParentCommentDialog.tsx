import { useEffect, useRef, useState } from 'react';
import { EyeOff, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CommentTextField } from '@/components/ui/CommentTextField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useImproveParentComment, usePublishParentComment } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { ParentCommentRow } from '@/lib/parentCommentsApi';

export function ParentCommentDialog({ lessonId, row, subjectName, date, onClose, onReload }: {
  lessonId: number; row: ParentCommentRow; subjectName: string; date: string;
  onClose: () => void; onReload: () => Promise<unknown>;
}) {
  const publish = usePublishParentComment(lessonId);
  const improve = useImproveParentComment(lessonId);
  const [saved, setSaved] = useState(row.comment ?? null);
  const [text, setText] = useState(row.comment?.text ?? '');
  const [editing, setEditing] = useState(!row.comment);
  const [original, setOriginal] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const busy = publish.isPending || improve.isPending;
  const dirty = text !== (saved?.text ?? '');
  const label = `Комментарий для родителя · ${subjectName} · ${new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  function close() {
    if (running.current) return;
    if (editing && dirty) setDiscard(true); else onClose();
  }
  async function generate() {
    if (running.current || !text.trim()) return;
    running.current = true;
    setError(null);
    const source = text;
    try {
      const result = await improve.mutateAsync({ studentId: row.studentProfileId!, text: source });
      if (!alive.current) return;
      setOriginal(prev => prev ?? source);
      setText(result.text ?? source);
      setAi(true);
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError && e.status === 429 ? e.message : 'Не удалось улучшить текст. Попробуйте ещё раз');
    } finally { running.current = false; }
  }
  async function save() {
    if (running.current || !text.trim() || !row.canEdit || conflict) return;
    running.current = true;
    setError(null);
    try {
      const result = await publish.mutateAsync({ studentId: row.studentProfileId!, text: text.trim(), version: saved?.version });
      if (!alive.current) return;
      setSaved(result); setText(result.text ?? text.trim()); setEditing(false); setOriginal(null); setAi(false);
    } catch (e) {
      if (!alive.current) return;
      setConflict(e instanceof ApiError && e.status === 409);
      setError(e instanceof ApiError && e.status === 409 ? e.message : 'Не удалось сохранить комментарий');
    } finally { running.current = false; }
  }
  async function reloadConflict() {
    await onReload();
    onClose(); // Keep the rejected draft visible until the teacher explicitly chooses to reload.
  }
  return <>
    <Modal open onClose={close} title={<span className="flex flex-wrap items-center gap-2">{row.fullName}
      {saved && <Badge tone="green">Опубликован</Badge>}</span>}
      subtitle={<span className="inline-flex items-center gap-1.5 text-xs"><EyeOff className="size-3.5" />Ученик не видит этот комментарий</span>} size="comment" appearance="composer" scrollable>
      <div className="flex flex-col gap-5">
        <CommentTextField label={label} value={text} onChange={setText} disabled={busy} generating={improve.isPending}
          aiGenerated={ai} readOnly={!editing} />
        {editing && original !== null && <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setText(original); setOriginal(null); setAi(false); }}>Вернуть мой текст</Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void generate()}>Ещё вариант</Button>
        </div>}
        {error && <div role="alert" className="text-sm text-red-600">{error}
          {conflict && <Button className="mt-2" variant="secondary" size="sm" onClick={() => void reloadConflict()}>Обновить комментарий</Button>}
        </div>}
        {!editing ? <div className="flex flex-col gap-3">
          {saved?.updated && <p className="text-xs text-muted">Обновлено · {new Date(saved.updatedAt!).toLocaleString('ru-RU')}</p>}
          {row.canEdit && <Button variant="secondary" onClick={() => { setEditing(true); setError(null); }}>Редактировать</Button>}
        </div> : <div className="flex gap-3">
          <Button className="flex-1 border border-navy-700 text-navy-700" variant="secondary" icon={<Sparkles className="size-4" />}
            disabled={busy || !text.trim() || conflict} onClick={() => void generate()}>Улучшить с AI</Button>
          <Button className="flex-1" loading={publish.isPending} disabled={busy || !text.trim() || !row.canEdit || conflict || (Boolean(saved) && !dirty)}
            onClick={() => void save()}>{saved ? 'Сохранить' : 'Опубликовать'}</Button>
        </div>}
      </div>
    </Modal>
    <ConfirmDialog open={discard} onClose={() => setDiscard(false)} onConfirm={onClose} title="Закрыть без сохранения?"
      message="Введённый текст не сохранён." confirmLabel="Закрыть" cancelLabel="Продолжить редактирование" />
  </>;
}
