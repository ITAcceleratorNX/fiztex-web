import type { ReactNode } from 'react';
import panelGlow from '@/assets/auth-panel-bg.webp';
import { Logo } from './Logo';
import { PrivacyLinks } from './PrivacyLinks';

/**
 * Рамка экранов входа сотрудников (Figma `phyztex` 2460:4665 W1 … 2460:4833 W4): на сером
 * фоне белая карточка во весь экран, слева синяя панель с подсветкой и обещанием продукта,
 * справа форма шириной 400 по центру и ссылки на политику внизу.
 *
 * Общая на все экраны сценария — вход, «забыли пароль», обязательная смена пароля идут
 * подряд, и менять фон под человеком на каждом шаге незачем. Подсветка панели — растровая
 * заливка из макета (`auth-panel-bg.webp`, перекодирована из PNG 1280×1624 с прозрачностью),
 * синий под ней — `navy-700`. Уже `lg` панель прячется, логотип встаёт над формой.
 */
export function StaffAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-auth-canvas p-3 sm:p-7">
      <div className="mx-auto flex w-full max-w-auth-card rounded-auth-card bg-surface p-4 shadow-auth">
        <div
          className="relative hidden basis-1/2 flex-col justify-between overflow-hidden rounded-auth-panel bg-navy-700 bg-cover bg-center p-11 lg:flex"
          style={{ backgroundImage: `url(${panelGlow})` }}
        >
          <Logo tone="white" />
          <div>
            <p className="text-40 font-bold leading-tight tracking-display text-white">
              <span className="block">Всё управление</span>
              {/* Короткое тире, а не длинное: с длинным строка на 1440 не помещается в панель
                  и заголовок рвётся на три строки (в макете — дефис, две строки). */}
              <span className="block">школой – в одной платформе</span>
            </p>
            <p className="mt-4 max-w-md text-base leading-6 text-white/80">
              Учебные процессы, приём, связь с родителями и{'\u00a0'}внутренние сервисы.
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center px-4 pb-6 pt-10 sm:px-8">
          <div className="mb-8 self-start lg:hidden">
            <Logo className="h-auto w-40 max-w-full" />
          </div>
          <div className="flex w-full max-w-auth-form flex-1 flex-col justify-center">
            {children}
          </div>
          <PrivacyLinks className="mt-8 text-center" />
        </div>
      </div>
    </div>
  );
}

/** Заголовок формы входа: 36/700 по центру и подзаголовок 15 серым (W1–W4). */
export function StaffAuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold leading-tight tracking-display text-planning-ink">{title}</h1>
      <p className="mt-2 text-15 leading-normal text-planning-muted">{subtitle}</p>
    </div>
  );
}
