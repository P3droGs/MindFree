// Ajustes do Android para o build de release.
// - Desliga o GIF e o WebP do <Image> do React Native. O MindFree mostra as fotos pelo expo-image, que tem
//   decodificadores próprios: cada celular baixa cerca de 0,8 MB a menos (https://docs.expo.dev/distribution/app-size/).
// - Guarda o construtor do banco do WorkManager, que os widgets do Android usam. O WorkManager 2.8.1 vem com o
//   Room 2.5, cuja regra do R8 guarda a classe e não o construtor: sem isto, o app fecha ao abrir no release.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const OFF = ['expo.gif.enabled', 'expo.webp.enabled'];
const KEEP_ROOM = '-keep class * extends androidx.room.RoomDatabase { <init>(); }';

module.exports = function withAndroidRelease(config) {
  config = withGradleProperties(config, (gradle) => {
    for (const key of OFF) {
      const item = gradle.modResults.find((entry) => entry.type === 'property' && entry.key === key);
      if (item) item.value = 'false';
      else gradle.modResults.push({ type: 'property', key, value: 'false' });
    }
    return gradle;
  });
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const rules = fs.readFileSync(file, 'utf8');
      if (!rules.includes(KEEP_ROOM)) {
        fs.writeFileSync(file, `${rules.trimEnd()}\n\n# Banco do WorkManager (plugins/android-release.js)\n${KEEP_ROOM}\n`);
      }
      return mod;
    },
  ]);
};
