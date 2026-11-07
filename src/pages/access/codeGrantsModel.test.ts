import { describe, expect, it } from 'vitest';
import type { StudentCodeGrant } from '@/lib/studentCodeGrantsApi';
import {
  activeGrants,
  expiresAtIso,
  expiryProblem,
  grantOutcomeMessage,
  hasActiveGrant,
} from './codeGrantsModel';

const NOW = new Date(2026, 10, 7, 12, 0, 0);

function grant(patch: Partial<StudentCodeGrant>): StudentCodeGrant {
  return { grantId: 1, teacherProfileId: 10, teacherName: 'Иванов Иван', active: true, ...patch };
}

describe('срок разрешения', () => {
  it('без срока ничего не отправляет', () => {
    expect(expiresAtIso({ choice: 'none', now: NOW })).toBeUndefined();
  });

  it('выбранная дата действует до конца своего дня', () => {
    // Иначе «до 5 декабря» истекало бы в ночь на 5-е, и учитель терял бы право
    // в день, который ему и назвали.
    const iso = expiresAtIso({ choice: 'custom', customDate: '2026-12-05', now: NOW });
    const moment = new Date(iso!);
    expect(moment.getFullYear()).toBe(2026);
    expect(moment.getMonth()).toBe(11);
    expect(moment.getDate()).toBe(5);
    expect(moment.getHours()).toBe(23);
  });

  it('конец учебного года берёт из года класса', () => {
    const iso = expiresAtIso({ choice: 'yearEnd', yearEndDate: '2027-05-25', now: NOW });
    expect(new Date(iso!).getDate()).toBe(25);
    expect(new Date(iso!).getMonth()).toBe(4);
  });

  it('месяц считает от сейчас', () => {
    const iso = expiresAtIso({ choice: 'month', now: NOW });
    expect(new Date(iso!).getMonth()).toBe(11);
  });
});

describe('что мешает выдать', () => {
  it('без срока претензий нет', () => {
    expect(expiryProblem({ choice: 'none', now: NOW })).toBeNull();
  });

  it('просит дату, пока её не выбрали', () => {
    expect(expiryProblem({ choice: 'custom', now: NOW })).toBe('Выберите дату');
  });

  it('не пускает прошедшую дату', () => {
    expect(expiryProblem({ choice: 'custom', customDate: '2026-11-01', now: NOW }))
      .toBe('Эта дата уже прошла');
  });

  it('учебный год без даты окончания отправляет выбрать вручную', () => {
    expect(expiryProblem({ choice: 'yearEnd', yearEndDate: null, now: NOW }))
      .toBe('У класса не видно учебного года — выберите дату вручную');
  });

  it('будущую дату принимает', () => {
    expect(expiryProblem({ choice: 'custom', customDate: '2026-12-05', now: NOW })).toBeNull();
  });
});

describe('свод разрешений ученика', () => {
  it('оставляет действующие и сортирует по учителю', () => {
    const rows = activeGrants([
      grant({ grantId: 1, teacherName: 'Якуб Асель' }),
      grant({ grantId: 2, teacherName: 'Абенов Алишер' }),
      grant({ grantId: 3, teacherName: 'Отозванный', active: false }),
    ]);
    expect(rows.map((row) => row.teacherName)).toEqual(['Абенов Алишер', 'Якуб Асель']);
  });

  it('истёкшее разрешение действующим не считает', () => {
    // `active` считает сервер: «не отозвано и срок не прошёл». Клиент даты не сравнивает,
    // иначе разошёлся бы с сервером на часовом поясе.
    expect(hasActiveGrant([grant({ active: false, teacherProfileId: 10 })], 10)).toBe(false);
    expect(hasActiveGrant([grant({ teacherProfileId: 10 })], 10)).toBe(true);
    expect(hasActiveGrant(undefined, 10)).toBe(false);
  });
});

describe('итог пакетной выдачи', () => {
  it('считает выданные', () => {
    expect(grantOutcomeMessage({ granted: 21, existed: 0, failed: 0 }))
      .toBe('Разрешение выдано: 21 ученик.');
  });

  it('уже выданное ошибкой не называет', () => {
    expect(grantOutcomeMessage({ granted: 3, existed: 2, failed: 0 }))
      .toBe('Разрешение выдано: 3 ученика, у 2 уже было.');
  });

  it('когда всем уже было, говорит это прямо', () => {
    expect(grantOutcomeMessage({ granted: 0, existed: 4, failed: 0 }))
      .toBe('Разрешение уже было у 4 учеников.');
  });

  it('о неудачах сообщает отдельно', () => {
    expect(grantOutcomeMessage({ granted: 2, existed: 0, failed: 1 }))
      .toBe('Разрешение выдано: 2 ученика, не удалось у 1 ученика.');
  });
});
