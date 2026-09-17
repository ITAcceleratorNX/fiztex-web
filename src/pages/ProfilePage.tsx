import { LogOut, Mail, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ErrorBlock } from '@/components/ui/StateBlock';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMyProfile } from '@/hooks/queries';
import { ROLE_LABELS } from '@/platform/labels';
import { childLabel, contactRows, profileFacts, relationLabel, teachingRows } from '@/lib/profileModel';
import type { AccountRole } from '@/platform/types';

/**
 * «Мой профиль» — единственный экран панели, который открывают все роли одинаково.
 *
 * Читает `GET /api/me/profile`: путь без идентификатора, поэтому чужой профиль отсюда
 * не открыть в принципе. Административные карточки людей (`/admin/teachers/:id`)
 * остались административными — учителю и психологу туда нельзя, и ходить за своими же
 * данными в чужой раздел было бы верным способом получить 401 и выход из системы.
 *
 * **Экран только читает.** Эндпоинта на смену имени, телефона или пароля нет, и рисовать
 * кнопку «Изменить», за которой ничего не стоит, хуже, чем её отсутствие: код доступа
 * выдаёт администратор, и это продуктовое решение, а не недоделка.
 *
 * Блоки показываются по тому, что пришло, а не по роли: у администратора нет школьной
 * карточки вовсе, у учителя без нагрузки — назначений. Ветвление по роли завело бы
 * второй источник правды и пустые таблицы там, где блока просто нет.
 */
export function ProfilePage() {
  useDocumentTitle('Мой профиль');
  const { admin, logout } = useAuth();
  const { data: profile, isPending, isError, refetch } = useMyProfile();

  // Имя и роль известны сразу после входа: экран профиля без имени выглядит сломанным,
  // пока едет запрос. Профиль дополняет их тем, чего в сессии нет, — классами и детьми.
  const fullName = profile?.fullName ?? admin?.fullName ?? '—';
  const role = (profile?.role ?? admin?.role) as AccountRole | undefined;
  const facts = profileFacts(profile);
  const contacts = contactRows(profile);
  const subjects = teachingRows(profile?.teacher?.assignments);
  const children = profile?.children ?? [];

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Мой профиль</h1>
        <p className="mt-1 text-sm text-slate-500">
          Данные учётной записи. Изменить их может администратор школы.
        </p>
      </header>

      <div className="card space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={fullName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">{fullName}</p>
            <p className="text-13 text-muted">{role ? ROLE_LABELS[role] ?? role : '—'}</p>
          </div>
        </div>

        {isError ? (
          <ErrorBlock message="Не удалось загрузить профиль" onRetry={() => void refetch()} />
        ) : (
          <>
            {contacts.length > 0 && (
              <Section title="Контакты">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {contacts.map((row) => (
                    <div key={row.label} className="flex items-center gap-2.5">
                      {row.label === 'Телефон' ? (
                        <Phone className="size-4 shrink-0 text-slate-400" />
                      ) : (
                        <Mail className="size-4 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <dt className="text-11 uppercase tracking-wide text-subtle">{row.label}</dt>
                        <dd className="truncate text-13 font-semibold text-ink">{row.value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
                {profile?.phone && (
                  <p className="text-11 text-subtle">Телефон — это и логин для входа в панель.</p>
                )}
              </Section>
            )}

            {facts.length > 0 && (
              <Section title="Учёба">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-11 uppercase tracking-wide text-subtle">{fact.label}</dt>
                      <dd className="text-13 font-semibold text-ink">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}

            {subjects.length > 0 && (
              <Section title="Что веду">
                {/* Строка — предмет, а не пара «предмет — класс»: у учителя одного
                    предмета на шесть классов это шесть одинаковых строк. */}
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {subjects.map((row) => (
                    <li
                      key={row.subjectId}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <span className="text-13 font-semibold text-ink">{row.subjectName}</span>
                      <span className="text-13 text-muted">{row.classNames.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {children.length > 0 && (
              <Section title="Дети">
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {children.map((child) => (
                    <li
                      key={child.studentProfileId}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2.5">
                        <Avatar name={childLabel(child)} size="sm" />
                        <span className="text-13 font-semibold text-ink">{childLabel(child)}</span>
                      </span>
                      <span className="text-13 text-muted">
                        {[child.className, relationLabel(child.relationType)].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {isPending && <p className="text-13 text-subtle">Загружаем данные профиля…</p>}
          </>
        )}

        <div className="border-t border-line pt-4">
          <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={logout}>
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-11 font-bold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}
