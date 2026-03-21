module.exports = {
  projects: [
    {
      displayName: 'client',
      testMatch: ['<rootDir>/tests/client/**/*.test.{ts,tsx,js,jsx}', '<rootDir>/src/**/*.test.{ts,tsx,js,jsx}'],
      moduleNameMapper: {
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css|scss)$': 'babel-jest',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
      setupFilesAfterEnv: ['<rootDir>/enzyme.config.js'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'server',
      testMatch: ['<rootDir>/tests/server/**/*.test.{ts,js}'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
        '^.+\\.js$': 'babel-jest',
      },
    },
  ],
};
