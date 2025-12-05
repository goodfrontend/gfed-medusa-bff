import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          isolatedModules: true,
          module: 'commonjs',
          target: 'ES2020',
        },
      },
    ],
    '^.+\\.[mc]?jsx?$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          isolatedModules: true,
          module: 'commonjs',
          target: 'ES2020',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!.*(msw|@mswjs/interceptors|headers-polyfill|until-async))',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@graphql/(.*)$': '<rootDir>/src/graphql/$1',
    '^@mocks/(.*)$': '<rootDir>/src/__mocks__/$1',
    '^@resolvers/(.*)$': '<rootDir>/src/resolvers/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
  setupFiles: ['<rootDir>/jest.env.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
  verbose: true,
  collectCoverage: false,
};

export default config;
