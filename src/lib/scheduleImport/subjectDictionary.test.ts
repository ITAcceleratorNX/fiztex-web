import { describe, expect, it } from 'vitest';
import { matchSubjectKeyByName, parseSubjectCell } from './subjectDictionary';

describe('parseSubjectCell', () => {
  it('отделяет инициалы учителя от предмета', () => {
    expect(parseSubjectCell('физ-ра КШ')).toMatchObject({
      subjectKey: 'PHYSICAL_EDUCATION',
      teacherText: 'КШ',
    });
  });

  it('узнаёт предмет на казахском и на русском одинаково', () => {
    expect(parseSubjectCell('қазақ тілі ИЛ').subjectKey).toBe('KAZ_LANGUAGE');
    expect(parseSubjectCell('каз яз ИЛ').subjectKey).toBe('KAZ_LANGUAGE');
    expect(parseSubjectCell('каз.язык ИЛ').subjectKey).toBe('KAZ_LANGUAGE');
  });

  it('не путает казахский язык с казахской литературой', () => {
    expect(parseSubjectCell('қаз.әдебиет РМ').subjectKey).toBe('KAZ_LITERATURE');
    expect(parseSubjectCell('қаз.тілі РМ').subjectKey).toBe('KAZ_LANGUAGE');
  });

  it('не принимает часть названия предмета за учителя', () => {
    // «ист. Каз» — история Казахстана без учителя, а не предмет «ист» у учителя «Каз».
    expect(parseSubjectCell('ист. Каз')).toMatchObject({
      subjectKey: 'KAZ_HISTORY',
      teacherText: '',
    });
  });

  it('оставляет без учителя предметы, где его не указали', () => {
    expect(parseSubjectCell('худ труд')).toMatchObject({
      subjectKey: 'ART_LABOUR',
      teacherText: '',
    });
    expect(parseSubjectCell('НВП').subjectKey).toBe('MILITARY_TRAINING');
    expect(parseSubjectCell('НВП').teacherText).toBe('');
  });

  it('переживает опечатки, встречающиеся в реальных файлах', () => {
    expect(parseSubjectCell('худ турд').subjectKey).toBe('ART_LABOUR');
    expect(parseSubjectCell('геграфия АБ').subjectKey).toBe('GEOGRAPHY');
    expect(parseSubjectCell('иинформатика БГ').subjectKey).toBe('INFORMATICS');
    expect(parseSubjectCell('Қаз тариз СА').subjectKey).toBe('KAZ_HISTORY');
  });

  it('переживает двойные пробелы и точки', () => {
    expect(parseSubjectCell('англ.яз  КА')).toMatchObject({
      subjectKey: 'ENGLISH',
      teacherText: 'КА',
    });
  });

  it('различает всемирную историю и историю Казахстана', () => {
    expect(parseSubjectCell('всемир Ист НА').subjectKey).toBe('WORLD_HISTORY');
    expect(parseSubjectCell('ист Каз НА').subjectKey).toBe('KAZ_HISTORY');
  });

  it('не сводит алгебру и геометрию к математике', () => {
    expect(parseSubjectCell('алгебра СС').subjectKey).toBe('ALGEBRA');
    expect(parseSubjectCell('геометрия НН').subjectKey).toBe('GEOMETRY');
    expect(parseSubjectCell('матем СС').subjectKey).toBe('MATH');
  });

  it('незнакомое написание отдаёт как есть, сняв похожие на инициалы буквы', () => {
    expect(parseSubjectCell('шахматы ВВ')).toEqual({
      subjectKey: null,
      subjectText: 'шахматы',
      teacherText: 'ВВ',
    });
  });
});

describe('matchSubjectKeyByName', () => {
  it('узнаёт предмет справочника по его названию', () => {
    expect(matchSubjectKeyByName('Казахский язык')).toBe('KAZ_LANGUAGE');
    expect(matchSubjectKeyByName('Физическая культура')).toBe('PHYSICAL_EDUCATION');
  });

  it('возвращает null для предмета вне словаря', () => {
    expect(matchSubjectKeyByName('Шахматы')).toBeNull();
  });
});
