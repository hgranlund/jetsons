module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '/tests/.*\\.(test|spec)?\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  reporters: ['default'],
  coverageReporters: ['cobertura', 'html'],
  bail: true,
  roots: ['src', 'tests'],
  tsconfig: "./tsconfig.test.json"
};
