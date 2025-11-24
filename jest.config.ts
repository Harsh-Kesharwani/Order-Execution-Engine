export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts','js'],
    verbose: true,
    setupFiles: ['dotenv/config'],
    setupFilesAfterEnv: ['<rootDir>/__tests__/setupWorker.ts'],   // <-- add this
    maxWorkers: 1
};
