import { glob } from 'glob';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mergeTypeDefs } from '@graphql-tools/merge';

const graphqlDir = join(__dirname);

const files = glob.sync('**/*.graphql', {
  cwd: graphqlDir,
  absolute: true,
});

const schemas = files.map((file) => readFileSync(file, 'utf8'));

export const typeDefs = mergeTypeDefs([...schemas]);
