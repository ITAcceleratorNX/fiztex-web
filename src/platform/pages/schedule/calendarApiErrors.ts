/**
 * Map calendar API 400 messages onto form fields (ТЗ §13 server errors at fields).
 * Bean-validation often looks like `title: must not be blank`.
 */
export function mapCalendarEventApiError(message: string): {
  fields: Partial<Record<'title' | 'dateFrom' | 'dateTo' | 'targets' | 'type' | 'effect', string>>;
  form?: string;
} {
  const m = message.trim();
  if (!m) return { fields: {}, form: 'Некорректный запрос' };

  const bean = m.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
  if (bean) {
    const field = bean[1]!;
    const text = bean[2]!;
    if (field === 'title') return { fields: { title: text } };
    if (field === 'dateFrom') return { fields: { dateFrom: text } };
    if (field === 'dateTo') return { fields: { dateTo: text } };
    if (field === 'type') return { fields: { type: text } };
    if (field === 'effect') return { fields: { effect: text } };
    if (field === 'scope' || field === 'targets' || field === 'grades' || field === 'classIds') {
      return { fields: { targets: text } };
    }
  }

  if (/dateFrom must be on or before dateTo/i.test(m)) {
    return { fields: { dateTo: 'Дата окончания должна быть не раньше даты начала' } };
  }
  if (/must lie within academic year/i.test(m)) {
    return { fields: { dateFrom: m, dateTo: m } };
  }
  if (/title must not be blank/i.test(m)) {
    return { fields: { title: 'Укажите название' } };
  }
  if (
    /GRADES scope requires|CLASSES scope requires|SCHOOL scope must not|GRADES scope must not|CLASSES scope must not/i.test(
      m,
    )
  ) {
    return { fields: { targets: m } };
  }
  if (/Pass either classId or grade/i.test(m)) {
    return { fields: { targets: m } };
  }

  return { fields: {}, form: m };
}
