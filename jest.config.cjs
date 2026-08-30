module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.cjs'],
  setupFiles: ['<rootDir>/jest.env.js'],
  globalSetup: '<rootDir>/jest.globalSetup.cjs',
  testTimeout: 15000,
};
