import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { pluralRu } from '@/lib/format';
import type { TestAiJob } from '@/lib/testTemplateApi';

export function WorkspaceAiApplyModal({ job, currentQuestionCount, busy, onApply, onClose }: {
  job: TestAiJob | null;
  currentQuestionCount: number;
  busy: boolean;
  onApply: (mode: 'REPLACE' | 'APPEND') => void;
  onClose: () => void;
}) {
  const generatedCount = job?.result?.questions?.length ?? 0;
  const combinedCount = currentQuestionCount + generatedCount;
  return <Modal open={job != null} onClose={() => { if (!busy) onClose(); }} title="Как использовать вопросы ИИ?" size="md"
    footer={<div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button>
      <Button variant="secondary" disabled={busy || generatedCount === 0 || generatedCount > 50}
        onClick={() => onApply('REPLACE')}>Заменить вопросы</Button>
      <Button disabled={busy || generatedCount === 0 || combinedCount > 50}
        onClick={() => onApply('APPEND')}>Добавить к текущим</Button>
    </div>}>
    <div className="space-y-3 text-sm text-muted">
      <p>Сейчас в тесте {currentQuestionCount} {pluralRu(currentQuestionCount, ['вопрос', 'вопроса', 'вопросов'])}. ИИ подготовил ещё {generatedCount}.</p>
      <p>При добавлении новые вопросы появятся в конце теста. Текущие вопросы, рисунки и ваши правки сохранятся. Всего будет {combinedCount} {pluralRu(combinedCount, ['вопрос', 'вопроса', 'вопросов'])}.</p>
      {combinedCount > 50 && <NoticeBar tone="warning">В одном тесте может быть до 50 вопросов. Для добавления уменьшите текущий набор или число вопросов генерации. Можно также заменить текущие вопросы.</NoticeBar>}
      <p>Изменения вступят в силу после сохранения теста.</p>
    </div>
  </Modal>;
}
