module.exports = { rootDir: '.', testRegex: '.*\\.integration\\.spec\\.ts$', transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] }, testEnvironment: 'node', testTimeout: 30000 };
