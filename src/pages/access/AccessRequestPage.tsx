import { useState } from 'react';
import { ArrowLeft, Check, Mail, X } from 'lucide-react';
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
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { avatarColor, cx, formatDateTime, initials, pluralRu } from '@/lib/format';
import {
  candidateBadges,
  candidateMeta,
  changedSincePrevious,
  childBadges,
  childMeta,
  isApproved,
  isDecided,
  loginMethodLabel,
  phoneLabel,
  rejectionTemplates,
  requestClassName,
  roleLabel,
  type MatchBadge,
} from './accessRequestModel';

type Detail = Schema<'AccessRequestDetailView'>;
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
    <section className="space-y-6">
      <Link
        to={REQUESTS_PATH}
        className="inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-navy-700"
      >
        <ArrowLeft className="size-4" />
        Заявки на доступ
      </Link>

      <RequestHeader detail={data} />
      {data.previousRequests?.length ? <PreviousDecision detail={data} /> : null}

      {undecided
        ? <PendingLayout detail={data} />
        : <DecidedLayout detail={data} />}
    </section>
  );
}

function RequestHeader({ detail }: { detail: Detail }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const decided = isDecided(detail);
  const suffix = decided ? (isApproved(detail) ? ' одобрена' : ' отклонена') : '';
  const parts = [roleLabel(detail.role)];
  if (detail.previousRequests?.length) parts.push('повторная заявка');
  parts.push(`подана ${formatDateTime(detail.submittedAt ?? detail.createdAt)}`);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Заявка № {detail.requestId}
          {suffix}
        </h1>
        <p className="mt-1 text-13 text-slate-500">{parts.join(' · ')} из приложения</p>
      </div>
      {!decided && (
        <>
          <Button variant="secondary" className="text-red-600" onClick={() => setRejectOpen(true)}>
            Отклонить заявку
          </Button>
          <RejectModal detail={detail} open={rejectOpen} onClose={() => setRejectOpen(false)} />
        </>
      )}
    </header>
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
    <div className="card flex flex-col gap-4 md:flex-row md:items-start md:gap-10">
      <div>
        <div className="text-13 font-semibold text-slate-900">Первая отправка отклонена</div>
        <div className="mt-1 text-13 text-slate-500">{formatDateTime(previous.decidedAt)}</div>
      </div>
      {previous.rejectionReason && (
        <div className="md:flex-1">
          <div className="text-10 font-semibold uppercase tracking-filter text-slate-400">Причина</div>
          <p className="mt-1 text-sm text-slate-700">{previous.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

function PendingLayout({ detail }: { detail: Detail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <RequestDataCard detail={detail} />
      <SuggestionsCard detail={detail} />
    </div>
  );
}

function RequestDataCard({ detail }: { detail: Detail }) {
  const changed = changedSincePrevious(detail);
  const className = detail.role === 'PARENT'
    ? requestClassName(detail.childClass)
    : requestClassName(detail.schoolClass);
  const codeLogin = !detail.passwordProvided || !detail.phone;

  return (
    <div className="card space-y-4 self-start">
      <h2 className="text-15 font-semibold text-slate-900">Данные из заявки</h2>

      <DataRow label="ФИО" value={detail.fullName} />
      {detail.role === 'PARENT' && (
        <DataRow label="Ребёнок" value={detail.childFullName ?? 'Не указан'} />
      )}
      <DataRow
        label={detail.role === 'PARENT' ? 'Класс ребёнка' : 'Класс'}
        value={className ?? 'Не указан'}
        note={changed.className ? `изменено, было ${changed.className}` : undefined}
      />
      <DataRow
        label="Телефон"
        value={phoneLabel(detail.phone)}
        note={changed.phone ? `изменено, было ${changed.phone}` : undefined}
      />
      <DataRow label="Способ входа после одобрения" value={loginMethodLabel(detail)} />

      <p className="rounded-lg bg-slate-50 p-3 text-13 text-slate-500">
        {codeLogin
          ? `Персональный код выдаст классный руководитель${className ? ` ${className}` : ''}: показать выданный код нельзя никому.`
          : 'Вход будет по телефону и паролю из заявки — пароль заявителя в системе не показывается.'}
      </p>
    </div>
  );
}

function DataRow({ label, value, note }: { label: string; value?: string; note?: string }) {
  return (
    <div>
      <div className="text-10 font-semibold uppercase tracking-filter text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900">
        {value || '—'}
        {note && <span className="ml-2 text-13 font-normal text-brand-600">{note}</span>}
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
    <div className="space-y-6">
      {detail.role === 'PARENT' && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-15 font-semibold text-slate-900">Ребёнок из заявки</h2>
            <p className="mt-1 text-13 text-slate-500">
              Родителя связывают с профилем ребёнка — без выбранного профиля заявку одобрить нельзя.
            </p>
          </div>

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
                  'flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition',
                  selected ? 'bg-brand-50 ring-brand-300' : 'bg-white ring-slate-200 hover:bg-slate-50',
                )}
              >
                <Avatar name={child.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{child.fullName}</div>
                  <div className="truncate text-13 text-slate-500">{childMeta(child)}</div>
                  <Badges badges={childBadges(detail, child)} />
                </div>
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

      <div className="card space-y-4">
        <div>
          <h2 className="text-15 font-semibold text-slate-900">Похожие профили в школе</h2>
          <p className="mt-1 text-13 text-slate-500">
            Сравните и выберите вручную — заявка не подтверждается автоматически.
          </p>
        </div>

        {conflicts.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-13 text-amber-800">
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

        {!suggestions.isPending && matches.length === 0 && (
          <EmptyBlock
            title="Похожих профилей нет"
            description="Ни по ФИО, ни по классу, ни по телефону совпадений не нашлось."
          />
        )}

        {matches.map((candidate, index) => (
          <div
            key={candidate.accountId}
            className={cx(
              'flex items-center gap-3 rounded-xl p-3 ring-1',
              index === 0 ? 'bg-white ring-brand-300' : 'bg-white ring-slate-200',
            )}
          >
            <Avatar name={candidate.fullName} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{candidate.fullName}</div>
              <div className="truncate text-13 text-slate-500">{candidateMeta(candidate)}</div>
              <Badges badges={candidateBadges(detail, candidate)} />
            </div>
            <Button
              size="sm"
              variant={index === 0 ? 'primary' : 'secondary'}
              loading={approve.isPending}
              onClick={() => approveWith({ accountId: candidate.accountId })}
            >
              Привязать
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="max-w-md text-13 text-slate-500">
            Новый профиль не создаётся, если человек уже есть в школе, — так не появится дубль.
          </p>
          <Button
            variant="secondary"
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

function Avatar({ name }: { name?: string }) {
  const color = avatarColor(name ?? '');
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-13 font-semibold"
      style={{ backgroundColor: color.bg, color: color.fg }}
    >
      {initials(name ?? '')}
    </span>
  );
}

const BADGE_TONES: Record<MatchBadge['tone'], string> = {
  match: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-orange-50 text-amber-700',
  miss: 'bg-slate-100 text-slate-500',
};

const BADGE_MARKS: Record<MatchBadge['tone'], string> = {
  match: '✓',
  partial: '≈',
  miss: '✗',
};

/** Плашка несёт только название признака — пояснения к ней живут в самой строке профиля. */
function Badges({ badges }: { badges: MatchBadge[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-11 font-semibold', BADGE_TONES[badge.tone])}
        >
          <span aria-hidden="true">{BADGE_MARKS[badge.tone]}</span>
          {badge.label}
        </span>
      ))}
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
      title={`Отклонить заявку № ${detail.requestId}?`}
      subtitle="Заявитель увидит причину в приложении и сможет отправить заявку повторно."
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={reject.isPending}
            onClick={() => void submit()}
          >
            Отклонить
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div>
          <div className="text-13 font-semibold text-slate-700">Частые причины</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => setReason(template.text)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-13 ring-1 transition',
                  reason === template.text
                    ? 'bg-navy-50 text-navy-700 ring-navy-400'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                )}
              >
                {template.label}
              </button>
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
      {isApproved(detail) ? <ApprovedCard detail={detail} /> : <RejectedCard detail={detail} />}
      <QueueCard currentRequestId={detail.requestId} />
    </div>
  );
}

function ApprovedCard({ detail }: { detail: Detail }) {
  const className = detail.role === 'PARENT'
    ? requestClassName(detail.childClass)
    : requestClassName(detail.schoolClass);
  const linked = detail.linkedAccount;
  const codeLogin = !detail.passwordProvided || !detail.phone;
  const profilePath = detail.role === 'PARENT' ? '/parents' : '/students';

  const steps = [
    'Заявитель увидит в приложении «Доступ открыт» по номеру заявки',
    'Push-уведомление «Заявка одобрена» — без кода, пароля и причин',
    codeLogin
      ? `Код выдаст классный руководитель${className ? ` ${className}` : ''}`
      : 'Вход по телефону и паролю из заявки',
  ];

  return (
    <div className="card space-y-4 self-start">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-4 text-emerald-600" aria-hidden="true" />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {detail.createdProfile ? 'Создан профиль' : 'Привязана к профилю'}
            {linked?.fullName ? ` ${linked.fullName}` : ''}
            {/* У родителя класс в заявке — класс ребёнка, и «Иванова, 5А» читалось бы так,
                будто в пятом классе учится она. Поэтому у него подписан сам ребёнок. */}
            {detail.role === 'PARENT'
              ? detail.childFullName
                ? ` · ребёнок ${detail.childFullName}${className ? `, ${className}` : ''}`
                : ''
              : className ? `, ${className}` : ''}
          </div>
          <div className="mt-0.5 text-13 text-slate-500">
            {detail.createdProfile
              ? 'Профиль заведён по заявке'
              : 'Профиль уже был в школе — новый не создавался'}
          </div>
          <div className="mt-0.5 text-13 text-slate-500">
            {formatDateTime(detail.decidedAt)}
            {detail.decidedByName ? ` · ${detail.decidedByName}` : ''}
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step} className="flex items-start gap-2 text-13 text-slate-600">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
            {step}
          </li>
        ))}
      </ul>

      {linked?.accountId && (
        <Link to={`${profilePath}/${linked.accountId}`}>
          <Button variant="secondary">
            {detail.role === 'PARENT' ? 'Открыть профиль родителя' : 'Открыть профиль ученика'}
          </Button>
        </Link>
      )}
    </div>
  );
}

function RejectedCard({ detail }: { detail: Detail }) {
  return (
    <div className="card space-y-4 self-start">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-red-100">
          <X className="size-4 text-red-600" aria-hidden="true" />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">Заявка отклонена</div>
          <div className="mt-0.5 text-13 text-slate-500">
            {formatDateTime(detail.decidedAt)}
            {detail.decidedByName ? ` · ${detail.decidedByName}` : ''}
          </div>
        </div>
      </div>

      {detail.rejectionReason && (
        <div>
          <div className="text-10 font-semibold uppercase tracking-filter text-slate-400">
            Причина для заявителя
          </div>
          <p className="mt-1 text-sm text-slate-700">{detail.rejectionReason}</p>
        </div>
      )}

      <p className="text-13 text-slate-500">
        Заявитель увидит причину в приложении и сможет подать заявку заново — она придёт новой строкой.
      </p>
    </div>
  );
}

/** Очередь после решения: не отчёт, а следующий шаг — администратор разбирает заявки подряд. */
function QueueCard({ currentRequestId }: { currentRequestId?: number }) {
  const navigate = useNavigate();
  const queue = useAccessRequests({ stage: 'PENDING', page: 0, size: 10 });
  const rows = (queue.data?.content ?? []).filter((row) => row.requestId !== currentRequestId);
  const total = queue.data?.totalElements ?? 0;

  if (queue.isPending) return <div className="card"><LoadingBlock /></div>;

  if (rows.length === 0) {
    return (
      <div className="card self-start">
        <EmptyBlock
          icon={<Mail className="size-6 text-slate-400" aria-hidden="true" />}
          title="Новых заявок нет"
          description="Все заявки рассмотрены. Новые появятся здесь и в меню."
          action={<Link to={REQUESTS_PATH}><Button variant="secondary">К списку заявок</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="card space-y-3 self-start">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-15 font-semibold text-slate-900">Ещё ждут решения</h2>
        <span className="text-13 text-slate-500">
          {total} {pluralRu(total, ['заявка', 'заявки', 'заявок'])}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.requestId} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-13 font-medium text-slate-900">{row.fullName}</div>
              <div className="truncate text-11 text-slate-500">
                {roleLabel(row.role)} · {formatDateTime(row.submittedAt ?? row.createdAt)}
              </div>
            </div>
            <Link
              to={`/admin/access-codes/requests/${row.requestId}`}
              className="text-13 text-navy-700 hover:underline"
            >
              Открыть
            </Link>
          </li>
        ))}
      </ul>

      {total > rows.length && (
        <Link to={REQUESTS_PATH} className="block text-13 text-slate-500 hover:text-navy-700">
          Все {total} {pluralRu(total, ['заявка', 'заявки', 'заявок'])} в списке
        </Link>
      )}

      <Button
        className="w-full"
        onClick={() => navigate(`/admin/access-codes/requests/${rows[0].requestId}`)}
      >
        Следующая заявка
      </Button>
    </div>
  );
}
