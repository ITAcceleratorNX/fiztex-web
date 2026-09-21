import { describe, expect, it } from 'vitest';
import { contactRows, profileFacts, relationLabel, teachingRows } from './profileModel';
import type { MyProfile } from './profileApi';

const ASSIGNMENTS = [
  { subjectId: 1, subjectName: 'Математика', classId: 3, className: '6А' },
  { subjectId: 1, subjectName: 'Математика', classId: 2, className: '5Б' },
  { subjectId: 1, subjectName: 'Математика', classId: 1, className: '5А' },
  { subjectId: 4, subjectName: 'Алгебра', classId: 9, className: '10А' },
];

describe('teachingRows', () => {
  it('складывает назначения одного предмета в одну строку', () => {
    const rows = teachingRows(ASSIGNMENTS);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.subjectName)).toEqual(['Алгебра', 'Математика']);
    expect(rows[1].classNames).toEqual(['5А', '5Б', '6А']);
  });

  it('классы сортирует естественно: десятый после девятого, а не после первого', () => {
    const rows = teachingRows([
      { subjectId: 1, subjectName: 'Физика', classId: 1, className: '10А' },
      { subjectId: 1, subjectName: 'Физика', classId: 2, className: '2А' },
      { subjectId: 1, subjectName: 'Физика', classId: 3, className: '9А' },
    ]);
    expect(rows[0].classNames).toEqual(['2А', '9А', '10А']);
  });

  it('повтор пары «предмет — класс» не удваивает класс', () => {
    const rows = teachingRows([...ASSIGNMENTS, ASSIGNMENTS[0]]);
    expect(rows.find((r) => r.subjectName === 'Математика')?.classNames).toEqual(['5А', '5Б', '6А']);
  });

  it('неполное назначение пропускается, а не рисует пустую строку', () => {
    expect(teachingRows([{ subjectId: 1, subjectName: undefined, className: '5А' }])).toEqual([]);
    expect(teachingRows(undefined)).toEqual([]);
  });
});

describe('profileFacts', () => {
  it('нагрузку учителя не дублирует — её показывает таблица «Что веду»', () => {
    const facts = profileFacts({ role: 'TEACHER', teacher: { assignments: ASSIGNMENTS } } as MyProfile);
    expect(facts).toEqual([]);
  });

  it('у администратора школьной карточки нет — и строк тоже', () => {
    expect(profileFacts({ role: 'ADMIN', children: [] } as MyProfile)).toEqual([]);
  });

  it('у учителя без нагрузки блока нет — это не пустая таблица', () => {
    expect(profileFacts({ role: 'TEACHER', teacher: { assignments: [] } } as MyProfile)).toEqual([]);
  });

  it('у ученика — класс и год', () => {
    const facts = profileFacts({
      role: 'STUDENT',
      student: { studentProfileId: 5, className: '7Б', academicYearName: '2026/2027' },
    } as MyProfile);
    expect(facts.map((f) => f.value)).toEqual(['7Б', '2026/2027']);
  });
});

describe('contactRows', () => {
  it('показывает только заполненное', () => {
    expect(contactRows({ phone: '+77001000000', email: null } as MyProfile)).toEqual([
      { label: 'Телефон', value: '+77001000000' },
    ]);
    expect(contactRows({} as MyProfile)).toEqual([]);
  });
});

describe('relationLabel', () => {
  it('подписывает известные связи и не выдумывает неизвестные', () => {
    expect(relationLabel('MOTHER')).toBe('Мама');
    expect(relationLabel('GUARDIAN')).toBe('Опекун');
    expect(relationLabel(null)).toBe('Родитель');
    expect(relationLabel('SOMETHING_NEW')).toBe('Родитель');
  });
});
