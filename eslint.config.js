// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // A função do Supabase roda no Deno, fora do app.
    ignores: ['dist/*', 'supabase/*'],
  },
]);
