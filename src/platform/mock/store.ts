import { MOCK_ACCESS_CODES } from './accessCodes';
import { MOCK_ACADEMIC_YEARS } from './academicYears';
import { MOCK_CLASSES } from './classes';
import { MOCK_PERIODS } from './periods';
import { MOCK_USERS } from './users';
import type {
  AccessCodeRow,
  AcademicPeriod,
  AcademicYear,
  PlatformUser,
  SchoolClass,
} from '../types';

/** In-memory mutable store — session-only; swap services for real API later. */
export const store = {
  users: MOCK_USERS.map((item) => ({ ...item })) as PlatformUser[],
  classes: MOCK_CLASSES.map((item) => ({ ...item })) as SchoolClass[],
  years: MOCK_ACADEMIC_YEARS.map((item) => ({ ...item })) as AcademicYear[],
  periods: MOCK_PERIODS.map((item) => ({ ...item })) as AcademicPeriod[],
  accessCodes: MOCK_ACCESS_CODES.map((item) => ({ ...item })) as AccessCodeRow[],
};

let seq = 1000;

export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}
