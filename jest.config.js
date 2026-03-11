module.exports = {
  projects: [
    {
      displayName: 'client',
      testMatch: ['<rootDir>/tests/client/**/*.test.{js,jsx}', '<rootDir>/src/**/*.test.{js,jsx}'],
      moduleNameMapper: { '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css|scss)$': 'babel-jest' },
      setupFilesAfterEnv: ['<rootDir>/enzyme.config.js'],
    },
    {
      displayName: 'server',
      testMatch: ['<rootDir>/tests/server/**/*.test.js'],
      testEnvironment: 'node',
    },
  ],
};
