import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../../fiztex-back/docs/formula-fixtures.json', import.meta.url);
const target = new URL('../src/test/fixtures/formula-fixtures.json', import.meta.url);
const fixtures = await readFile(source, 'utf8');

if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== fixtures) {
    console.error('Formula fixtures differ from the backend contract. Run pnpm sync:formula-fixtures.');
    process.exitCode = 1;
  }
} else {
  await writeFile(target, fixtures);
}
