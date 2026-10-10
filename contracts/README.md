# Проверки формул между модулями

Обычные проверки веба (`pnpm lint`, `pnpm typecheck:test`, `pnpm test`,
`pnpm build`) работают из одного checkout `fiztex-web`. CI деплоя не требует
репозиториев бэкенда, мобилки или запущенного API.

`src/test/fixtures/formula-fixtures.json` — версионируемый снимок
`fiztex-back/docs/formula-fixtures.json`. Источник контракта остаётся в бэкенде;
снимок вручную не редактировать. После изменения источника в локальном монорепо:

```bash
pnpm sync:formula-fixtures
pnpm test:contracts
```

`pnpm test:contracts` явно требует соседние checkout `fiztex-back` и
`fiztex-mobile`. Проверяет совпадение снимка, разметки веба/RN и реального
автономного RN-бандла KaTeX, включая mhchem. Отсутствующие файлы или рассинхронизация
роняют проверку; она не пропускает тесты при отсутствии модулей.

Зафиксировать обновлённый снимок вместе с изменением соответствующей поддержки
формул. Быстрая проверка снимка без рендеринга: `pnpm sync:formula-fixtures --check`.
