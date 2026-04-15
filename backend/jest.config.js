'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.js'],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
  clearMocks: true,
};
