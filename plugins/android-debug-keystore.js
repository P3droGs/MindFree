// Assina os builds feitos no computador com a keystore de debug do usuário (~/.android/debug.keystore).
// O modelo do React Native traz uma debug.keystore igual em todo projeto, portanto pública: a SHA-1 dela não
// deve ir para o Firebase, senão qualquer app assinado com ela passaria pelo login com Google. A do usuário
// existe só nesta máquina, e é a SHA-1 dela que fica cadastrada. As duas usam a senha e o apelido padrão do
// Android, então o build.gradle não muda.
// No EAS isto não muda a assinatura: lá o EAS injeta o android/app/eas-build.gradle, que assina com a
// keystore guardada no Expo (https://docs.expo.dev/build-reference/android-builds/).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withAndroidDebugKeystore(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const own = path.join(os.homedir(), '.android', 'debug.keystore');
      if (fs.existsSync(own)) {
        fs.copyFileSync(own, path.join(mod.modRequest.platformProjectRoot, 'app', 'debug.keystore'));
      }
      return mod;
    },
  ]);
};
