import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import {
  useAccessRequest,
  useAccessRequestSuggestions,
  useAccessRequests,
  useApproveAccessRequest,
  useRejectAccessRequest,
} from '@/hooks/queries';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select, TextArea } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx, formatDayMonthTime, formatShortDayMonth, pluralRu } from '@/lib/format';
import {
  candidateBadges,
  candidateMeta,
  changedSincePrevious,
  childBadges,
  childMeta,
  isApproved,
  isDecided,
  loginMethodLabel,
  rejectionTemplates,
  requestClassName,
  roleLabel,
  type MatchBadge,
} from './accessRequestModel';

type Detail = Schema<'AccessRequestDetailView'>;
type Row = Schema<'AccessRequestRowView'>;
type ApproveBody = Schema<'ApproveAccessRequestRequest'>;
type Relation = NonNullable<ApproveBody['relationType']>;

const REQUESTS_PATH = '/admin/access-codes?tab=requests';

const RELATION_LABELS: Record<Relation, string> = {
  MOTHER: 'Мать',
  FATHER: 'Отец',
  GUARDIAN: 'Опекун',
  OTHER: 'Другое',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function AccessRequestPage() {
  const { requestId: idParam } = useParams();
  const requestId = Number(idParam);
  const detail = useAccessRequest(requestId);
  const data = detail.data;
  const undecided = data ? !isDecided(data) : false;

  if (detail.isPending) return <LoadingBlock />;
  if (detail.isError || !data) {
    return (
      <ErrorBlock
        message={errorMessage(detail.error, 'Не удалось загрузить заявку. Попробуйте ещё раз.')}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <RequestHeader detail={data} />
      {data.previousRequests?.length ? <PreviousDecision detail={data} /> : null}

      {undecided
        ? <PendingLayout detail={data} />
        : <DecidedLayout detail={data} />}
    </section>
  );
}

/** «Ученик» / «Родитель» — подлежащее в подсказках карточки. */
function applicantNoun(detail: Detail): string {
  return detail.role === 'PARENT' ? 'Родитель' : 'Ученик';
}

function requestedClass(detail: Detail): string | null {
  return detail.role === 'PARENT'
    ? requestClassName(detail.childClass)
    : requestClassName(detail.schoolClass);
}

/**
 * Подзаголовок шапки (D2 / D2-R / D4). До решения — кто и когда подал, после — когда и кто
 * решил: сама заявка уже описана в карточке итога.
 */
function headerSubtitle(detail: Detail): string {
  if (isDecided(detail)) {
    const decided = formatDayMonthTime(detail.decidedAt);
    return detail.decidedByName ? `${decided} · ${detail.decidedByName}` : decided;
  }
  const submitted = formatDayMonthTime(detail.submittedAt ?? detail.createdAt);
  return detail.previousRequests?.length
    ? `${roleLabel(detail.role)} · повторная заявка · ${submitted}`
    : `${roleLabel(detail.role)} · подана ${submitted} из приложения`;
}

function RequestHeader({ detail }: { detail: Detail }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const decided = isDecided(detail);
  const suffix = decided ? (isApproved(detail) ? ' одобрена' : ' отклонена') : '';

  return (
    <>
      <PageHeader
        back={{ label: 'Заявки на доступ', to: REQUESTS_PATH, appearance: 'link' }}
        title={`Заявка № ${detail.requestId}${suffix}`}
        description={headerSubtitle(detail)}
        // Карточка показывает решение, журнал — всё, что с доступом этого человека
        // делали потом: коды, PIN, временные пароли. Это разные вопросы.
        meta={(
          <Link
            to={`/admin/access-codes?tab=journal&request=${detail.requestId}`}
            className={buttonClassName({ variant: 'link', size: 'text' })}
          >
            История в журнале доступа
          </Link>
        )}
        actionsAlign="end"
        actions={!decided && (
          <Button variant="danger-outline" onClick={() => setRejectOpen(true)}>
            Отклонить заявку
          </Button>
        )}
      />
      {!decided && <RejectModal detail={detail} open={rejectOpen} onClose={() => setRejectOpen(false)} />}
    </>
  );
}

/**
 * Прошлое решение по цепочке повторных заявок. Имени того, кто отклонил, здесь нет:
 * реестр отдаёт прошлые заявки строками, а подпись решившего живёт только в карточке
 * самой заявки — и спрашивать её вторым запросом ради одной строки незачем.
 */
function PreviousDecision({ detail }: { detail: Detail }) {
  const previous = detail.previousRequests?.[0];
  if (!previous) return null;
  return (
    <div className="card flex flex-col gap-4 p-6 md:flex-row md:items-start md:gap-8">
      <div className="md:w-56 md:shrink-0">
        <div className="text-15 font-bold leading-tight text-planning-ink">Первая отправка отклонена</div>
        <div className="mt-1 text-13 leading-4 text-planning-muted">{formatDayMonthTime(previous.decidedAt)}</div>
      </div>
      {previous.rejectionReason && (
        <div className="min-w-0 md:flex-1">
          <div className="text-xs text-planning-subtle">Причина</div>
          <p className="mt-1 break-words text-15 leading-relaxed text-planning-ink">{previous.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

function PendingLayout({ detail }: { detail: Detail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-access-request">
      <RequestDataCard detail={detail} />
      <SuggestionsCard detail={detail} />
    </div>
  );
}

function RequestDataCard({ detail }: { detail: Detail }) {
  const changed = changedSincePrevious(detail);
  const className = requestedClass(detail);
  const codeLogin = !detail.passwordProvided || !detail.phone;
  const whose = detail.role === 'PARENT' ? '' : ' ученику';

  return (
    <div className="card flex flex-col gap-4 self-start p-6">
      <h2 className="text-base font-bold text-planning-ink">Данные из заявки</h2>

      <DataRow label="ФИО" value={detail.fullName} />
      {detail.role === 'PARENT' && <DataRow label="Ребёнок" value={detail.childFullName} />}
      <DataRow
        label={detail.role === 'PARENT' ? 'Класс ребёнка' : 'Класс'}
        value={className}
        note={changed.className ? `изменено, было ${changed.className}` : undefined}
      />
      <DataRow
        label="Телефон"
        value={detail.phone?.trim() ? detail.phone : null}
        note={changed.phone ? `изменено, было ${changed.phone}` : undefined}
      />
      <DataRow label="Способ входа после одобрения" value={loginMethodLabel(detail)} />

      <p className="border-t border-planning-row-line pt-4 text-13 leading-relaxed text-planning-muted">
        {codeLogin
          ? `Код${whose} выдаст классный руководитель${className ? ` ${className}` : ''}.`
          : `${applicantNoun(detail)} будет входить по телефону и паролю из заявки.`}
      </p>
    </div>
  );
}

/** Пустое значение — «Не указан» обычным серым: в заявке его нет, а не «—» неизвестно что. */
function DataRow({ label, value, note }: { label: string; value?: string | null; note?: string }) {
  return (
    <div>
      <div className="text-xs text-planning-subtle">{label}</div>
      <div className={cx('mt-1 break-words text-15 leading-tight', value ? 'font-semibold text-planning-ink' : 'text-planning-subtle')}>
        {value || 'Не указан'}
        {note && <span className="ml-1.5 text-13 font-normal text-amber-700">{note}</span>}
      </div>
    </div>
  );
}

function SuggestionsCard({ detail }: { detail: Detail }) {
  const toast = useToast();
  const requestId = detail.requestId ?? 0;
  const suggestions = useAccessRequestSuggestions(requestId, true);
  const approve = useApproveAccessRequest(requestId);
  const [childProfileId, setChildProfileId] = useState<number | null>(null);
  const [relation, setRelation] = useState<Relation>('MOTHER');
  const [duplicate, setDuplicate] = useState<ApproveBody | null>(null);

  async function send(body: ApproveBody) {
    try {
      await approve.mutateAsync(body);
      toast.success('Заявка одобрена');
    } catch (error) {
      // Тёзка в классе — не ошибка ввода, а вопрос: заводить второго такого ученика
      // или это он же. Отвечает администратор, поэтому запрос уходит повторно с
      // подтверждением, а не «само собой» с `confirmDuplicate` в первом вызове.
      if (error instanceof ApiError && error.code === 'STUDENT_DUPLICATE_SUSPECTED') {
        setDuplicate(body);
        return;
      }
      toast.error(errorMessage(error, 'Не удалось одобрить заявку. Попробуйте ещё раз.'));
    }
  }

  function approveWith(target: { accountId?: number; createProfile?: boolean }) {
    if (detail.version == null) return;
    if (detail.role === 'PARENT' && !childProfileId) {
      toast.error('Выберите ребёнка из заявки — без него связать родителя не с кем.');
      return;
    }
    void send({
      ...target,
      version: detail.version,
      ...(detail.role === 'PARENT'
        ? { childStudentProfileId: childProfileId ?? undefined, relationType: relation }
        : {}),
    });
  }

  const matches = suggestions.data?.applicantMatches ?? [];
  const children = suggestions.data?.childCandidates ?? [];
  const conflicts = suggestions.data?.phoneConflicts ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {detail.role === 'PARENT' && (
        <div className="card flex flex-col gap-4 p-6">
          <CardTitle
            title="Ребёнок из заявки"
            description="Родителя связывают с профилем ребёнка — без выбранного профиля заявку одобрить нельзя."
          />

          {suggestions.isPending && <LoadingBlock />}
          {children.length === 0 && !suggestions.isPending && (
            <EmptyBlock
              title="Подходящих учеников не нашлось"
              description="Проверьте ФИО и класс ребёнка в заявке или заведите ученика в разделе «Ученики»."
            />
          )}
          {children.map((child) => {
            const selected = child.studentProfileId === childProfileId;
            return (
              <button
                key={child.studentProfileId}
                type="button"
                aria-pressed={selected}
                onClick={() => setChildProfileId(child.studentProfileId ?? null)}
                className={cx(
                  'flex w-full items-center gap-5 rounded-xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400',
                  selected ? 'border-navy-700 bg-navy-50' : 'border-line bg-surface hover:bg-planning-canvas',
                )}
              >
                <Avatar name={child.fullName ?? ''} size="lg" variant={selected ? 'navy' : 'navy-soft'} />
                <ProfileSummary name={child.fullName} meta={childMeta(child)} badges={childBadges(detail, child)} />
              </button>
            );
          })}

          <Field label="Кем приходится" required>
            <Select value={relation} onChange={(event) => setRelation(event.target.value as Relation)}>
              {Object.entries(RELATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div className="card flex flex-col gap-4 p-6">
        <CardTitle
          title="Похожие профили в школе"
          description="Сравните и выберите вручную — заявка не привязывается автоматически."
        />

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-planning-warning-border bg-planning-warning p-3 text-13 leading-relaxed text-amber-700">
            Телефон из заявки уже привязан: {conflicts.map((item) => item.fullName).join(', ')}.
            Связывание телефон не перезаписывает — сменить его можно отдельным действием.
          </div>
        )}

        {suggestions.isPending && <LoadingBlock />}
        {suggestions.isError && (
          <ErrorBlock
            message={errorMessage(suggestions.error, 'Не удалось загрузить подсказки.')}
            onRetry={() => void suggestions.refetch()}
          />
        )}

        {!suggestions.isPending && !suggestions.isError && matches.length === 0 && (
          <EmptyBlock
            title="Похожих профилей нет"
            description="Ни по ФИО, ни по классу, ни по телефону совпадений не нашлось."
          />
        )}

        {/* Первый профиль — самый похожий: подсказки приходят упорядоченными по совпадению. */}
        {matches.map((candidate, index) => (
          <div
            key={candidate.accountId}
            className={cx('flex items-center gap-5 rounded-xl border p-5', index === 0 ? 'border-navy-700' : 'border-line')}
          >
            <Avatar name={candidate.fullName ?? ''} size="lg" variant={index === 0 ? 'navy' : 'navy-soft'} />
            <ProfileSummary name={candidate.fullName} meta={candidateMeta(candidate)} badges={candidateBadges(detail, candidate)} />
            <Button
              className="shrink-0"
              variant={index === 0 ? 'primary' : 'secondary'}
              loading={approve.isPending}
              onClick={() => approveWith({ accountId: candidate.accountId })}
            >
              Привязать
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <p className="max-w-sm text-13 leading-relaxed text-planning-muted">
            {detail.role === 'PARENT'
              ? 'Новый профиль не создаётся, если родитель уже есть в школе, — так не появится дубль.'
              : 'Новый профиль не создаётся, если ученик уже есть в импорте из Excel, — так в школе не появится дубль.'}
          </p>
          <Button
            variant="secondary"
            className="shrink-0"
            loading={approve.isPending}
            onClick={() => approveWith({ createProfile: true })}
          >
            Создать новый профиль
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(duplicate)}
        onClose={() => setDuplicate(null)}
        title="В классе уже есть ученик с похожим ФИО"
        message="Создать второго? Если это тот же человек, вернитесь и привяжите заявку к его профилю."
        confirmLabel="Всё равно создать"
        loading={approve.isPending}
        onConfirm={() => {
          const body = duplicate;
          setDuplicate(null);
          if (body) void send({ ...body, confirmDuplicate: true });
        }}
      />
    </div>
  );
}

function CardTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-planning-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-planning-muted">{description}</p>}
    </div>
  );
}

function ProfileSummary({ name, meta, badges }: { name?: string; meta: string; badges: MatchBadge[] }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-15 font-bold leading-tight text-planning-ink">{name}</div>
      {meta && <div className="mt-1 truncate text-13 leading-4 text-planning-muted">{meta}</div>}
      <MatchBadges badges={badges} />
    </div>
  );
}

const MATCH_TONES: Record<MatchBadge['tone'], { tone: BadgeTone; mark: string; spoken: string }> = {
  match: { tone: 'green', mark: '✓', spoken: 'совпадает' },
  partial: { tone: 'amber', mark: '≈', spoken: 'похоже' },
  miss: { tone: 'gray', mark: '✕', spoken: 'не совпадает' },
};

/**
 * Плашка несёт только название признака (D2-S) — пояснения к ней живут в самой строке
 * профиля. Значок виден глазу, а скринридер слышит то же словом.
 */
function MatchBadges({ badges }: { badges: MatchBadge[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {badges.map((badge) => {
        const look = MATCH_TONES[badge.tone];
        return (
          <Badge key={badge.key} appearance="chip" tone={look.tone} icon={<span aria-hidden="true">{look.mark}</span>}>
            {badge.label}
            <span className="sr-only">: {look.spoken}</span>
          </Badge>
        );
      })}
    </div>
  );
}

function RejectModal({ detail, open, onClose }: { detail: Detail; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const reject = useRejectAccessRequest(detail.requestId ?? 0);
  const [reason, setReason] = useState('');
  const templates = rejectionTemplates(detail);

  async function submit() {
    if (detail.version == null || !reason.trim()) return;
    try {
      await reject.mutateAsync({ reason: reason.trim(), version: detail.version });
      toast.success('Заявка отклонена');
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Не удалось отклонить заявку. Попробуйте ещё раз.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="planning"
      title={`Отклонить заявку № ${detail.requestId}?`}
      subtitle="Заявитель увидит причину в приложении и сможет отправить заявку повторно."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={reject.isPending}
            onClick={() => void submit()}
          >
            Отклонить
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-sm font-semibold text-planning-ink">Частые причины</div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {templates.map((template) => (
              <FilterChip
                key={template.label}
                appearance="outline"
                label={template.label}
                selected={reason === template.text}
                onClick={() => setReason(template.text)}
              />
            ))}
          </div>
        </div>

        <Field label="Причина для заявителя" required hint="Без причины заявку отклонить нельзя">
          <TextArea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Что заявителю исправить, чтобы заявку приняли"
          />
        </Field>
      </div>
    </Modal>
  );
}

function DecidedLayout({ detail }: { detail: Detail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-access-decision">
      {isApproved(detail) ? <ApprovedCard detail={detail} /> : <RejectedCard detail={detail} />}
      <QueueCard currentRequestId={detail.requestId} />
    </div>
  );
}

/** Итог решения: круг со знаком, заголовок и пояснение под ним (D4). */
function OutcomeHeading({ tone, title, description }: { tone: 'approved' | 'rejected'; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className={cx(
          'flex size-11 shrink-0 items-center justify-center rounded-full',
          tone === 'approved' ? 'bg-planning-success text-planning-success-fg' : 'bg-red-50 text-red-700',
        )}
      >
        {tone === 'approved'
          ? <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
          : <X className="size-5" strokeWidth={2.5} aria-hidden="true" />}
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="break-words text-base font-bold text-planning-ink">{title}</div>
        {description && <div className="mt-0.5 text-sm text-planning-muted">{description}</div>}
      </div>
    </div>
  );
}

function ApprovedCard({ detail }: { detail: Detail }) {
  const className = requestedClass(detail);
  const linked = detail.linkedAccount;
  const codeLogin = !detail.passwordProvided || !detail.phone;
  const profilePath = detail.role === 'PARENT' ? '/parents' : '/students';
  const noun = applicantNoun(detail);

  // Два шага уже случились при одобрении, последний — за людьми: поэтому у него стрелка.
  const steps: Array<{ text: string; done: boolean }> = [
    { text: `${noun} увидит в приложении «Доступ открыт» по номеру заявки`, done: true },
    { text: 'Push-уведомление «Заявка одобрена» — без кода и пароля', done: true },
    {
      text: codeLogin
        ? `Код выдаст классный руководитель${className ? ` ${className}` : ''}`
        : `${noun} входит по телефону и паролю из заявки`,
      done: false,
    },
  ];

  const title = [
    detail.createdProfile ? 'Создан профиль' : 'Привязана к профилю',
    linked?.fullName ? ` ${linked.fullName}` : '',
    // У родителя класс в заявке — класс ребёнка, и «Иванова, 5А» читалось бы так,
    // будто в пятом классе учится она. Поэтому у него подписан сам ребёнок.
    detail.role === 'PARENT'
      ? detail.childFullName ? ` · ребёнок ${detail.childFullName}${className ? `, ${className}` : ''}` : ''
      : className ? `, ${className}` : '',
  ].join('');

  return (
    <div className="card flex flex-col gap-4 self-start p-6">
      <OutcomeHeading
        tone="approved"
        title={title}
        description={detail.createdProfile ? 'Профиль заведён по заявке' : 'Профиль уже был в школе — новый не создавался'}
      />

      <ul className="flex flex-col gap-3 border-t border-planning-row-line pt-4">
        {steps.map((step) => (
          <li key={step.text} className="flex items-start gap-2.5 text-sm text-planning-ink">
            {step.done
              ? <Check className="mt-0.5 size-4 shrink-0 text-planning-success-fg" strokeWidth={2.5} aria-hidden="true" />
              : <ArrowRight className="mt-0.5 size-4 shrink-0 text-planning-subtle" aria-hidden="true" />}
            {step.text}
          </li>
        ))}
      </ul>

      {linked?.accountId && (
        <Link
          to={`${profilePath}/${linked.accountId}`}
          className={buttonClassName({ variant: 'secondary', className: 'mt-1 self-start' })}
        >
          {detail.role === 'PARENT' ? 'Открыть профиль родителя' : 'Открыть профиль ученика'}
        </Link>
      )}
    </div>
  );
}

function RejectedCard({ detail }: { detail: Detail }) {
  return (
    <div className="card flex flex-col gap-4 self-start p-6">
      <OutcomeHeading tone="rejected" title="Заявка отклонена" />

      {detail.rejectionReason && (
        <div className="border-t border-planning-row-line pt-4">
          <div className="text-xs text-planning-subtle">Причина для заявителя</div>
          <p className="mt-1 break-words text-15 leading-relaxed text-planning-ink">{detail.rejectionReason}</p>
        </div>
      )}

      <p className="text-13 leading-relaxed text-planning-muted">
        Заявитель увидит причину в приложении и сможет подать заявку заново — она придёт новой строкой.
      </p>
    </div>
  );
}

/** Класс в строке очереди: у родителя — класс ребёнка, подпись «ребёнок в» здесь лишняя. */
function queueMeta(row: Row): string {
  const className = row.role === 'PARENT' ? row.childClassName : row.className;
  return [roleLabel(row.role), className, formatShortDayMonth(row.submittedAt ?? row.createdAt)]
    .filter(Boolean)
    .join(' · ');
}

/** Очередь после решения: не отчёт, а следующий шаг — администратор разбирает заявки подряд. */
function QueueCard({ currentRequestId }: { currentRequestId?: number }) {
  const navigate = useNavigate();
  const queue = useAccessRequests({ stage: 'PENDING', page: 0, size: 10 });
  const rows = (queue.data?.content ?? []).filter((row) => row.requestId !== currentRequestId);
  const total = queue.data?.totalElements ?? 0;
  const requestsWord = pluralRu(total, ['заявка', 'заявки', 'заявок']);

  if (queue.isPending) return <div className="card self-start"><LoadingBlock /></div>;

  if (queue.isError) {
    return (
      <div className="card self-start">
        <ErrorBlock
          message={errorMessage(queue.error, 'Не удалось загрузить заявки. Попробуйте ещё раз.')}
          onRetry={() => void queue.refetch()}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card self-start px-6">
        <EmptyBlock
          title="Новых заявок нет"
          description="Все заявки рассмотрены. Новые появятся здесь и в меню."
          action={<Link to={REQUESTS_PATH} className={buttonClassName({ variant: 'secondary' })}>К списку заявок</Link>}
        />
      </div>
    );
  }

  return (
    <div className="card flex flex-col self-start p-6">
      <div className="flex items-baseline justify-between gap-2 pb-3">
        <h2 className="text-base font-bold text-planning-ink">Ещё ждут решения</h2>
        <span className="shrink-0 text-13 text-planning-muted">{total} {requestsWord}</span>
      </div>

      <ul>
        {rows.map((row) => (
          <li key={row.requestId} className="flex items-center gap-3 border-t border-planning-row-line py-3.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-planning-ink">{row.fullName}</div>
              <div className="mt-0.5 truncate text-13 leading-4 text-planning-muted">{queueMeta(row)}</div>
            </div>
            <Link
              to={`/admin/access-codes/requests/${row.requestId}`}
              className={buttonClassName({ variant: 'link', size: 'text', className: 'shrink-0' })}
            >
              Открыть
            </Link>
          </li>
        ))}
      </ul>

      {total > rows.length && (
        <div className="border-t border-planning-row-line pt-3.5 text-center">
          <Link to={REQUESTS_PATH} className={buttonClassName({ variant: 'link', size: 'text' })}>
            Все {total} {requestsWord} в списке
          </Link>
        </div>
      )}

      <Button
        className="mt-4 w-full"
        onClick={() => navigate(`/admin/access-codes/requests/${rows[0].requestId}`)}
      >
        Следующая заявка
      </Button>
    </div>
  );
}
