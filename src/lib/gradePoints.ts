export function validateGradePoints(score: string, maxScore: string) {
  const value = Number(score);
  const maximum = Number(maxScore);
  const maxError = !/^\d+$/.test(maxScore) || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1000
    ? 'Введите целый максимальный балл от 1 до 1000'
    : null;
  const scoreError = !/^\d+$/.test(score) || !Number.isSafeInteger(value) || value < 0 || (!maxError && value > maximum)
    ? `Введите целый балл от 0 до ${maxError ? 'максимального балла' : maximum}`
    : null;
  return { value, maximum, scoreError, maxError, valid: !scoreError && !maxError };
}
