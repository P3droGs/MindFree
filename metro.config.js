// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Pacotes que ficam fora do app: do build nativo, pelo `expo.autolinking` do package.json; e do pacote JS,
// aqui. Quem pede um deles dentro de try/catch (como o expo-router e o @expo/ui) segue sem ele; quem pedir
// sem try/catch faz o pacote falhar já na hora de montar, e não no celular.
// - Animação: o expo-router instala para recursos que o MindFree não usa (menu lateral e pilha em JavaScript).
const UNUSED = new Set(['react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler']);
// - Só servem aos widgets do iPhone. Os do Android usam o react-native-android-widget.
const UNUSED_ON_ANDROID = new Set(['@expo/ui', 'expo-widgets']);

const packageOf = (moduleName) => moduleName.split('/').slice(0, moduleName.startsWith('@') ? 2 : 1).join('/');
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = packageOf(moduleName);
  if (UNUSED.has(name) || (platform === 'android' && UNUSED_ON_ANDROID.has(name))) {
    throw new Error(`${moduleName} não faz parte do MindFree${platform === 'android' ? ' no Android' : ''}.`);
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
