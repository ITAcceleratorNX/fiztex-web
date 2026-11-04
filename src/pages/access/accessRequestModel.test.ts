import { describe, expect, it } from 'vitest';
import type { Schema } from '@/lib/apiSchemas';
import {
  candidateBadges,
  changedSincePrevious,
  childBadges,
  loginMethodLabel,
  rejectionTemplates,
  rowClassLabel,
} from './accessRequestModel';

type Detail = Schema<'AccessRequestDetailView'>;

const studentRequest: Detail = {
  requestId: 48213,
  role: 'STUDENT',
  stage: 'PENDING',
  fullName: 'Сейтқазы Арман Ерланович',
  schoolClass: { classId: 5, currentName: '5А', snapshotName: '5А', active: true },
};

const parentRequest: Detail = {
  requestId: 48207,
  role: 'PARENT',
  stage: 'PENDING',
  fullName: 'Кабылова Амина Сериковна',
  phone: '+7 700 100 00 14',
  passwordProvided: true,
  childFullName: 'Кабылов Тимур Серикович',
  childClass: { classId: 5, currentName: '5А', snapshotName: '5А', active: true },
};

describe('строка реестра заявок', () => {
  it('у родителя показывает класс ребёнка, а не свой', () => {
    expect(rowClassLabel({ role: 'PARENT', childClassName: '5А' })).toBe('ребёнок в 5А');
    expect(rowClassLabel({ role: 'STUDENT', className: '9Б' })).toBe('9Б');
  });

  it('не выдумывает класс, которого в заявке нет', () => {
    expect(rowClassLabel({ role: 'PARENT' })).toBe('ребёнок не указан');
  });
});

describe('способ входа после одобрения', () => {
  it('пароль без телефона не считается способом входа', () => {
    expect(loginMethodLabel({ ...studentRequest, passwordProvided: true })).toBe('Персональный код и PIN');
  });

  it('телефон с паролем из заявки — вход по телефону', () => {
    expect(loginMethodLabel(parentRequest)).toBe('Телефон и пароль');
  });
});

describe('плашки совпадений', () => {
  it('совпавшее ФИО в заявленном классе — две зелёные плашки', () => {
    expect(candidateBadges(studentRequest, { matchReasons: ['CLASS_AND_NAME'], className: '5А' }))
      .toEqual([
        { key: 'name', label: 'ФИО', tone: 'match' },
        { key: 'class', label: 'Класс', tone: 'match' },
      ]);
  });

  it('однофамилец в классе — ФИО частично, класс совпал', () => {
    expect(candidateBadges(studentRequest, { matchReasons: ['SAME_LAST_NAME_IN_CLASS'], className: '5А' }))
      .toEqual([
        { key: 'name', label: 'ФИО', tone: 'partial' },
        { key: 'class', label: 'Класс', tone: 'match' },
      ]);
  });

  it('совпадение по телефону из другого класса', () => {
    const withPhone: Detail = { ...studentRequest, phone: '+7 777 000 00 00' };
    expect(candidateBadges(withPhone, { matchReasons: ['SAME_PHONE'], className: '7Б' }))
      .toEqual([
        { key: 'name', label: 'ФИО', tone: 'miss' },
        { key: 'class', label: 'Класс', tone: 'miss' },
        { key: 'phone', label: 'Телефон', tone: 'match' },
      ]);
  });

  it('без телефона в заявке плашки телефона нет', () => {
    const badges = candidateBadges(studentRequest, { matchReasons: ['EXACT_NAME'] });
    expect(badges.map((badge) => badge.key)).toEqual(['name', 'class']);
  });

  it('у родителя своего класса в заявке нет — плашки класса тоже', () => {
    const badges = candidateBadges(parentRequest, { matchReasons: ['EXACT_NAME', 'SAME_PHONE'] });
    expect(badges.map((badge) => badge.key)).toEqual(['name', 'phone']);
  });

  it('ребёнок сравнивается по своему классу', () => {
    expect(childBadges(parentRequest, { matchReasons: ['NAME_WITHOUT_MIDDLE'], className: '5А' }))
      .toEqual([
        { key: 'name', label: 'ФИО', tone: 'partial' },
        { key: 'class', label: 'Класс', tone: 'match' },
      ]);
  });
});

describe('повторная заявка', () => {
  it('показывает, что заявитель поправил класс', () => {
    const repeat: Detail = {
      ...studentRequest,
      schoolClass: { classId: 7, currentName: '7Б', snapshotName: '7Б', active: true },
      previousRequests: [{ requestId: 48100, className: '7А', stage: 'REJECTED' }],
    };
    expect(changedSincePrevious(repeat)).toEqual({ className: '7А' });
  });

  it('молчит, когда заявитель ничего не менял', () => {
    const repeat: Detail = {
      ...studentRequest,
      previousRequests: [{ requestId: 48100, className: '5А', stage: 'REJECTED' }],
    };
    expect(changedSincePrevious(repeat)).toEqual({});
  });
});

describe('частые причины отказа', () => {
  it('подставляет класс заявки и не придумывает другой', () => {
    const [first] = rejectionTemplates(studentRequest);
    expect(first.text).toContain('В 5А');
    expect(first.text).not.toContain('возможно');
  });

  it('у родителя берёт класс ребёнка', () => {
    expect(rejectionTemplates(parentRequest)[0].text).toContain('В 5А');
  });
});
