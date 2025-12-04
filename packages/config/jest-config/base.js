const storefrontJestConfig = {
  testEnvironment: 'jsdom',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'package.json',
    'package-lock.json',
  ],
  testPathIgnorePatterns: ['<rootDir>/packages/eslint-config', '<rootDir>/packages/typescript-config', '<rootDir>/packages/prettier-config', '<rootDir>/packages/jest-config'],
};

const nodeJestConfig = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'package.json',
    'package-lock.json',
  ],
  testPathIgnorePatterns: ['<rootDir>/packages'],
};

module.exports = { storefrontJestConfig, nodeJestConfig };
