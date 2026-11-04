import type { ReactNode } from 'react';
import { Logo, PhysTechMark } from '@/components/layout/Logo';
import { PrivacyLinks } from '@/components/layout/PrivacyLinks';

/**
 * Карточка экранов входа сотрудников (макет W1–W4): синяя панель с обещанием продукта
 * слева, форма справа.
 *
 * Общая на все три экрана — вход, «забыли пароль» и обязательная смена пароля идут
 * подряд одним сценарием, и перерисовывать рамку между ними значило бы менять фон под
 * человеком на каждом шаге.
 */
export function StaffAuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-8">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200">
        <div className="relative hidden w-[45%] shrink-0 flex-col justify-between overflow-hidden rounded-2xl bg-navy-700 p-10 lg:flex">
          <PhysTechMark className="pointer-events-none absolute -right-20 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-white/[0.06]" />
          <Logo className="relative h-auto w-56 max-w-full" />
          <div className="relative">
            <h2 className="max-w-xs text-[28px] font-bold leading-tight text-white">
              Всё управление школой — в одной платформе
            </h2>
            <p className="mt-4 max-w-sm text-13 text-slate-300">
              Учебные процессы, приём, связь с родителями и внутренние сервисы.
            </p>
          </div>
        </div>

        <div className="flex min-h-[520px] w-full flex-col justify-between p-6 sm:p-10 lg:p-14">
          <div className="mb-8 lg:hidden">
            <Logo className="h-auto w-48 max-w-full" />
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
            {children}
          </div>
          <PrivacyLinks className="mt-8 text-center" />
        </div>
      </div>
    </div>
  );
}
