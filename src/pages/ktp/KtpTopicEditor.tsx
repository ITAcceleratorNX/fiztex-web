import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import type { KtpTopic } from '@/lib/ktpApi';

export type KtpEditableField = 'title' | 'learningObjectives' | 'recommendations' | 'notes' | 'plannedDates' | 'plannedHours' | 'sourceNumber';
export function KtpTopicEditor({ topic, onSave, onClose, onDelete, inline = false, initialField = 'title' }: { topic: KtpTopic; onSave: (topic: KtpTopic) => void; onClose: () => void; onDelete?: () => void; inline?: boolean; initialField?: KtpEditableField }) {
  const [value, setValue] = useState(topic);
  const [hours, setHours] = useState(topic.plannedHours?.toString() ?? '');
  const validHours = Number(hours) > 0 && Number.isFinite(Number(hours)) && /^\d+(\.\d{1,4})?$/.test(hours);
  function text(field: 'title' | 'learningObjectives' | 'recommendations' | 'notes' | 'plannedDates' | 'sourceNumber', next: string) { setValue(current => ({ ...current, [field]: next })); }
  const actions = <><Button variant="navy" size="sm" disabled={!value.title?.trim() || !validHours} onClick={() => onSave({ ...value, plannedHours: Number(hours) })}>Сохранить изменения</Button><Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button></>;
  const fields = <div className="grid gap-4 lg:grid-cols-planning-editor">
    <Field className="lg:col-span-1" label="Тема урока" required><TextArea autoFocus={initialField === 'title'} value={value.title ?? ''} rows={5} maxLength={65536} onChange={e => text('title', e.target.value)} /></Field>
    <Field className="lg:col-span-1" label="Цели обучения"><TextArea autoFocus={initialField === 'learningObjectives'} value={value.learningObjectives ?? ''} rows={5} placeholder="Можно оставить пустым" onChange={e => text('learningObjectives', e.target.value)} /></Field>
    <Field className="lg:col-span-1" label="Часы" required error={hours && !validHours ? 'Укажите положительные часы, не более четырёх знаков после запятой' : undefined}><TextInput autoFocus={initialField === 'plannedHours'} type="number" min="0" step="1" value={hours} onChange={e => setHours(e.target.value)} /></Field>
    <Field className="lg:col-span-1" label="Плановые сроки"><TextInput autoFocus={initialField === 'plannedDates'} value={value.plannedDates ?? ''} onChange={e => text('plannedDates', e.target.value)} /></Field>
    <Field className="lg:col-span-1" label="Рекомендации / виды деятельности"><TextArea autoFocus={initialField === 'recommendations'} value={value.recommendations ?? ''} rows={3} onChange={e => text('recommendations', e.target.value)} /></Field>
    <div className="lg:col-span-3"><details open={initialField === 'notes' || initialField === 'sourceNumber'} className="rounded-xl border border-planning-line bg-white p-3"><summary className="cursor-pointer text-13 font-medium text-planning-muted">Примечания и номер в документе</summary><div className="mt-3 space-y-3">
      <Field label="Примечания"><TextArea autoFocus={initialField === 'notes'} value={value.notes ?? ''} rows={2} onChange={e => text('notes', e.target.value)} /></Field><Field label="Номер в документе"><TextInput autoFocus={initialField === 'sourceNumber'} value={value.sourceNumber ?? ''} onChange={e => text('sourceNumber', e.target.value)} /></Field>
    </div></details></div>
  </div>;
  if (!inline) return <Modal open onClose={onClose} title="Редактирование темы" size="xl" scrollable footer={actions}>{fields}</Modal>;
  return <section role="region" aria-label={`Редактирование темы ${topic.sourceNumber ?? topic.order ?? 'новой'}`} className="space-y-4 p-4">{fields}
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-planning-subtle"><p>Правка меняет только данные в системе — исходный файл остаётся как был.</p>{onDelete && <Button variant="ghost" size="sm" onClick={onDelete}>Удалить тему</Button>}</div><div className="flex flex-wrap gap-2">{actions}</div></div>
  </section>;
}
