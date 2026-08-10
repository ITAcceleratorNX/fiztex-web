import { describe, expect, it } from 'vitest';
import { PRIVACY_POLICY, POLICY_UI, type PolicyDocument } from './privacyPolicy';

const LOCALES = ['ru', 'en'] as const;

/** Разделов в документе-источнике (`fiztex-back/policy.txt`) — 18 в каждой версии. */
const SECTION_COUNT = 18;

function blocksOf(doc: PolicyDocument) {
  return doc.sections.flatMap((section) => section.blocks);
}

describe('политика конфиденциальности', () => {
  it.each(LOCALES)('версия «%s» содержит все 18 разделов', (locale) => {
    expect(PRIVACY_POLICY[locale].sections).toHaveLength(SECTION_COUNT);
  });

  /**
   * Главный риск для двуязычного юридического документа — правка одной версии
   * и забытая вторая. Совпадение числа разделов это ловит.
   */
  it('обе версии описывают одинаковый набор разделов', () => {
    expect(PRIVACY_POLICY.ru.sections).toHaveLength(PRIVACY_POLICY.en.sections.length);
  });

  it.each(LOCALES)('в версии «%s» нет пустых заголовков и блоков', (locale) => {
    const doc = PRIVACY_POLICY[locale];
    expect(doc.title.trim()).not.toBe('');
    expect(doc.updatedAt.trim()).not.toBe('');

    for (const section of doc.sections) {
      expect(section.title.trim(), `раздел «${section.title}»`).not.toBe('');
      expect(section.blocks.length, `раздел «${section.title}» пуст`).toBeGreaterThan(0);
    }

    for (const block of blocksOf(doc)) {
      if (block.type === 'ul') {
        expect(block.items.length).toBeGreaterThan(0);
        for (const item of block.items) expect(item.trim()).not.toBe('');
      } else {
        expect(block.text.trim()).not.toBe('');
      }
    }
  });

  it.each(LOCALES)('в версии «%s» указаны контакты оператора', (locale) => {
    const text = blocksOf(PRIVACY_POLICY[locale])
      .map((b) => (b.type === 'ul' ? b.items.join(' ') : b.text))
      .join(' ');

    expect(text).toContain('TMK TECHNOHORIZON LTD.');
    expect(text).toContain('240140900168');
    expect(text).toContain('support@tmk-technohorizon.kz');
    expect(text).toContain('+7 747 907 16 22');
  });

  it('переключатель языка ведёт на противоположную версию', () => {
    expect(POLICY_UI.ru.otherLocale).toBe('en');
    expect(POLICY_UI.en.otherLocale).toBe('ru');
  });
});
