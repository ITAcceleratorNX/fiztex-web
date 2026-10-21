import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrimaryAssessmentNotice } from './PrimaryAssessmentNotice';

describe('PrimaryAssessmentNotice', () => {
  it('does not promise an active calculation before approval', () => {
    render(<PrimaryAssessmentNotice startDate="2026-09-01" active={false} />);
    expect(screen.getByText(/Для запуска расчёта утвердите политику/)).toBeInTheDocument();
    expect(screen.queryByText(/журнал автоматически рассчитывает результат/)).not.toBeInTheDocument();
    expect(screen.getByText(/2–4 классы: ФО 50%/)).toBeInTheDocument();
  });

  it('explains coverage and primary physical education without a separate template', () => {
    render(<PrimaryAssessmentNotice startDate="2027-09-01" active />);
    expect(screen.getByText(/В периодах, для которых утверждена политика/)).toHaveTextContent(/Отдельный шаблон.*не нужно/);
    expect(screen.getByText(/включая физкультуру и музыку/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Правила РК/ })).toHaveAttribute('href', 'https://old.adilet.zan.kz/rus/docs/V2600039896');
  });

  it('keeps the new formula out of historical school years', () => {
    render(<PrimaryAssessmentNotice startDate="2025-09-01" active />);
    expect(screen.getByText(/Исторические оценки сохраняют прежний порядок/)).toBeInTheDocument();
    expect(screen.queryByText(/ФО 50%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/При ФО оценивайте/)).not.toBeInTheDocument();
  });

  it('explains formative coverage and retention without claiming that compliance was checked', () => {
    render(<PrimaryAssessmentNotice startDate="2026-09-01" active />);
    const obligations = screen.getByText(/При ФО оценивайте/);
    expect(obligations).toHaveTextContent(/При ФО оценивайте каждого ученика по каждому предмету не менее чем на 30% проведённых уроков, охватывая не менее 50% учебных целей/);
    expect(obligations).toHaveTextContent('Письменные работы ПО храните до конца учебного года.');
    expect(obligations).not.toHaveTextContent(/проверен|соблюден|соблюдён/i);
  });
});
