import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KtpTopicEditor } from './KtpTopicEditor';

describe('KtpTopicEditor source numbers from multiple document paragraphs', () => {
  it('keeps numbers readable and preserves the original number when another field changes', async () => {
    const onSave = vi.fn();
    render(<KtpTopicEditor inline initialField="notes" topic={{ order: 43, sourceNumber: '43\n44', title: 'Мутации', plannedHours: 2, learningObjectives: '8.4.4.1' }} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Номер в документе' })).toHaveValue('43 44');
    await userEvent.type(screen.getByRole('textbox', { name: 'Примечания' }), 'Проверено');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sourceNumber: '43\n44', plannedHours: 2, learningObjectives: '8.4.4.1', notes: 'Проверено' }));
  });
});
