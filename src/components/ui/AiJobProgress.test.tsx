import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiJobProgress } from './AiJobProgress';
import type { HomeworkAiJob } from '@/lib/homeworkAiApi';

function job(overrides: Partial<HomeworkAiJob>): HomeworkAiJob {
  return { id: 1, homeworkId: 2, kind: 'MATERIAL', status: 'RUNNING', ...overrides };
}

/**
 * Здесь проверяется не вёрстка, а обещание из §2.1 плана: ожидание объясняется словами.
 * Неподвижный индикатор — главная причина, по которой человек решает, что приложение
 * зависло, и жмёт кнопку второй раз.
 */
describe('AiJobProgress', () => {
  it('называет фазу словами и добавляет счётчик шагов', () => {
    render(<AiJobProgress job={job({ phase: 'READING_MATERIALS', progressDone: 4, progressTotal: 12 })} />);
    expect(screen.getByText('Читаю материалы урока · 4 из 12')).toBeInTheDocument();
  });

  /** «1 из 1» — шум: у одиночного вызова бэкенд счётчик и не присылает. */
  it('без счётчика шагов показывает одну фазу', () => {
    render(<AiJobProgress job={job({ phase: 'CALLING_MODEL' })} />);
    expect(screen.getByText('Составляю')).toBeInTheDocument();
  });

  it('счётчик из одного шага не показывает', () => {
    render(<AiJobProgress job={job({ phase: 'CALLING_MODEL', progressDone: 0, progressTotal: 1 })} />);
    expect(screen.getByText('Составляю')).toBeInTheDocument();
  });

  /** Пока фазы нет — задача взята в работу, но ещё не дошла до первого шага. */
  it('без фазы говорит, что начинает', () => {
    render(<AiJobProgress job={job({ status: 'PENDING' })} />);
    expect(screen.getByText('Начинаю…')).toBeInTheDocument();
  });

  it('пока идёт — сообщает, что окно можно закрыть', () => {
    render(<AiJobProgress job={job({ phase: 'CALLING_MODEL' })} />);
    expect(screen.getByText(/Окно можно закрыть/)).toBeInTheDocument();
  });

  /** Ошибка — не поломка приложения: рядом всегда есть, что делать дальше. */
  it('при отказе показывает причину и запасное действие', () => {
    render(
      <AiJobProgress
        job={job({ status: 'FAILED', errorMessage: 'Модель недоступна' })}
        fallbackAction={<button type="button">Написать самому</button>}
      />,
    );
    expect(screen.getByText('Не удалось сгенерировать')).toBeInTheDocument();
    expect(screen.getByText('Модель недоступна')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Написать самому' })).toBeInTheDocument();
  });

  /** Успех с оговоркой остаётся успехом, но оговорку учитель обязан увидеть. */
  it('успех с предупреждением показывает и то и другое', () => {
    render(
      <AiJobProgress job={job({ status: 'DONE', warningMessage: 'Текст обрезан по длине' })} />,
    );
    expect(screen.getByText('Готово')).toBeInTheDocument();
    expect(screen.getByText('Текст обрезан по длине')).toBeInTheDocument();
  });

  it('без задачи не рисует ничего', () => {
    const { container } = render(<AiJobProgress job={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
