import { Button } from '@/components/ui/Button';
import { StatusNotice } from '@/components/ui/StatusNotice';
import type { KtpContent } from '@/lib/ktpApi';
import { isOptionalKtpIssue, ktpIssueContext, ktpIssueDescription, ktpIssueTopic, optionalKtpIssueGroups, type KtpIssue } from '@/lib/ktpIssues';

type Props = { issues: KtpIssue[]; content?: KtpContent; onEditTopic?: (issue: KtpIssue) => void; onShowIssue?: (issue: KtpIssue) => void; appearance?: 'default' | 'review' };

export function KtpIssueDetails({ issue, content, onEditTopic }: Omit<Props, 'issues'> & { issue: KtpIssue }) {
  const { message, values } = ktpIssueDescription(issue);
  const context = ktpIssueContext(issue, content);
  return <div className="space-y-2">
    <p>{message}</p>
    {context && <p className="break-words text-13">{context}</p>}
    {values && <p className="break-words text-13">{values}</p>}
    {onEditTopic && ktpIssueTopic(issue, content) && <Button variant="secondary" size="sm" onClick={() => onEditTopic(issue)}>Исправить</Button>}
  </div>;
}

export function KtpIssues({ issues, content, onEditTopic, onShowIssue, appearance = 'default' }: Props) {
  const errors = issues.filter(issue => issue.severity === 'ERROR');
  const warnings = issues.filter(issue => issue.severity === 'WARNING' && !isOptionalKtpIssue(issue));
  const optional = optionalKtpIssueGroups(issues);
  const optionalCount = optional.reduce((count, group) => count + group.issues.length, 0);
  return <>
    {appearance === 'review' && (errors.length > 0 || warnings.length > 0) && <ul aria-label="Результат проверки КТП" className="overflow-hidden rounded-planning-panel border border-planning-line bg-white">
      {[...errors, ...warnings].map((issue, index) => {
        const description = ktpIssueDescription(issue), context = ktpIssueContext(issue, content), topic = ktpIssueTopic(issue, content);
        const isError = issue.severity === 'ERROR';
        const hoursError = topic && ['TOPIC_HOURS_REQUIRED', 'TOPIC_HOURS_INVALID'].includes(issue.code ?? '');
        const title = hoursError ? `Тема № ${topic.topic.sourceNumber ?? topic.topic.order}: ${issue.code === 'TOPIC_HOURS_REQUIRED' ? 'не указано количество часов' : 'проверьте количество часов'}`
          : issue.code === 'TOTAL_HOURS_MISMATCH' ? `${context || 'Часы по плану'} · ${description.values}` : description.message;
        return <li key={index} className={`flex items-start gap-3 border-b border-planning-row-line px-4 py-3 last:border-0 ${isError ? 'bg-red-50' : ''}`}>
          <span aria-hidden="true" className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${isError ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-amber-700'}`}>{isError ? '!' : 'i'}</span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-planning-ink">{title}</p><p className="mt-1 text-13 text-planning-muted">{issue.code === 'TOTAL_HOURS_MISMATCH' ? description.message : context}</p></div>
          {topic && onEditTopic ? <Button variant="secondary" size="sm" onClick={() => onEditTopic(issue)}>Исправить</Button> : onShowIssue && /^periods\[/.test(issue.fieldPath ?? '') && <Button variant="secondary" size="sm" onClick={() => onShowIssue(issue)}>Показать</Button>}
        </li>;
      })}
    </ul>}
    {appearance !== 'review' && errors.map((issue, index) => <StatusNotice key={index} tone="error"><KtpIssueDetails issue={issue} content={content} onEditTopic={onEditTopic} /></StatusNotice>)}
    {appearance !== 'review' && warnings.length > 0 && <details className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-amber-900">Предупреждения · {warnings.length}</summary>
      <ul className="mt-3 space-y-4 text-13 text-amber-900">{warnings.map((issue, index) => <li key={index}><KtpIssueDetails issue={issue} content={content} onEditTopic={onEditTopic} /></li>)}</ul>
    </details>}
    {optionalCount > 0 && <details className={appearance === 'review' ? 'text-13 text-planning-muted' : 'rounded-xl border border-line bg-surface p-4'}>
      <summary className="cursor-pointer text-sm font-medium text-ink">Необязательные поля · {optionalCount}</summary>
      <p className="mt-3 text-13 text-muted">Эти поля можно оставить пустыми — они не мешают подтвердить КТП.</p>
      <div className="mt-4 space-y-3">{optional.map(group => <details key={group.label} className="rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-13 font-medium text-ink">{group.label} · не заполнено: {group.issues.length}</summary>
        <ul className="mt-3 space-y-3 text-13">{group.issues.map((issue, index) => {
          const context = ktpIssueContext(issue, content);
          return <li key={index} className="flex flex-wrap items-start justify-between gap-3">
            <p className="min-w-0 flex-1 break-words text-muted">{context || 'Не указано в документе'}</p>
            {onEditTopic && ktpIssueTopic(issue, content) && <Button variant="secondary" size="sm" aria-label={`Дополнить поле «${group.label}»: ${context}`} onClick={() => onEditTopic(issue)}>Дополнить</Button>}
          </li>;
        })}</ul>
      </details>)}</div>
    </details>}
  </>;
}
