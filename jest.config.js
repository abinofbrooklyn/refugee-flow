module.exports = {
  projects: [
    {
      displayName: 'client',
      testMatch: ['<rootDir>/tests/client/**/*.test.{ts,tsx,js,jsx}', '<rootDir>/src/**/*.test.{ts,tsx,js,jsx}'],
      moduleNameMapper: {
        '\\.svg$': '<rootDir>/tests/client/__mocks__/svgMock.js',
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css|scss)$': 'babel-jest',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
      // d3 v7 ships ESM-only packages; transform them through babel-jest
      transformIgnorePatterns: [
        '/node_modules/(?!(d3|d3-[a-z-]+|internmap|delaunator|robust-predicates)/)',
      ],
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
