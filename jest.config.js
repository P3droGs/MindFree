// https://docs.expo.dev/develop/unit-testing/
// Testes do app em Node (sem emulador): as regras puras de src/lib e src/state, e as telas com a
// @testing-library/react-native. O SQL do servidor é testado à parte, por `npm run test:sql`.
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // O armazenamento do celular vira um Map em memória nos testes.
    '^expo-sqlite/kv-store$': '<rootDir>/src/test/kv-store.mock.ts',
  },
  setupFiles: ['<rootDir>/src/test/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
};
