export function validatePages(from: string, to: string, total: number, limit: number): string {
  if (!from && !to) return total > limit ? 'Укажите нужные страницы: за один раз можно обработать до ' + limit + '.' : '';
  const first = Number(from);
  const last = Number(to || from);
  if (!from || !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > total) {
    return 'Укажите страницы от 1 до ' + total + ', в порядке возрастания.';
  }
  return last - first + 1 > limit ? 'Выберите не больше ' + limit + ' страниц.' : '';
}
