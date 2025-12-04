import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

const plugins = [];
try {
  plugins.push(
    requireFromHere.resolve('@trivago/prettier-plugin-sort-imports')
  );
} catch {}

/** @type {import("prettier").Config} */
export default {
  arrowParens: 'always',
  printWidth: 80,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^@[a-zA-Z0-9_-]+/(.*)$',   // external or internal scoped packages
    '^@/(.*)$',                 // local alias
    '^([./])|^([../])',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  plugins,
};
