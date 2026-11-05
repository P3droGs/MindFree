// Visual inicial dos widgets do Android.
// O react-native-android-widget desenha o widget num trabalho em segundo plano (WorkManager) que o Android
// pode adiar por minutos logo depois de colocar o widget ou de reiniciar o celular. Até lá, o layout inicial
// da biblioteca é transparente: o widget parece não existir. Este plugin troca o layout inicial de cada
// widget por um cartão escuro com o nome do app, que some assim que o conteúdo de verdade chega.
// Os arquivos dos widgets (res/xml/widgetprovider_*.xml) são escritos pela biblioteca num "dangerous mod";
// este plugin mexe neles numa fase posterior (a do manifesto), quando já existem.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('expo/config-plugins');

const LAYOUT = 'mindfree_widget_placeholder';
const BACKGROUND = 'mindfree_widget_placeholder_bg';

const layoutXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por plugins/android-widget-placeholder.js: o que o widget mostra antes do primeiro desenho. -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/${BACKGROUND}"
    android:gravity="center"
    android:orientation="vertical"
    android:padding="16dp">
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="MindFree"
        android:textColor="#C7B8FF"
        android:textSize="16sp"
        android:textStyle="bold" />
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="···"
        android:textColor="#A9AED6"
        android:textSize="18sp" />
</LinearLayout>
`;

const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por plugins/android-widget-placeholder.js. -->
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#10142E" />
    <corners android:radius="28dp" />
    <stroke android:width="1dp" android:color="#2A3060" />
</shape>
`;

module.exports = function withAndroidWidgetPlaceholder(config) {
  return withAndroidManifest(config, (mod) => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    fs.mkdirSync(path.join(res, 'layout'), { recursive: true });
    fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
    fs.writeFileSync(path.join(res, 'layout', `${LAYOUT}.xml`), layoutXml);
    fs.writeFileSync(path.join(res, 'drawable', `${BACKGROUND}.xml`), backgroundXml);

    const xmlDir = path.join(res, 'xml');
    const providers = fs.existsSync(xmlDir) ? fs.readdirSync(xmlDir).filter((name) => name.startsWith('widgetprovider_')) : [];
    if (providers.length === 0) {
      throw new Error('android-widget-placeholder: nenhum res/xml/widgetprovider_*.xml; o plugin do react-native-android-widget precisa rodar antes.');
    }
    for (const name of providers) {
      const file = path.join(xmlDir, name);
      const xml = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, xml.replace('android:initialLayout="@layout/rn_widget"', `android:initialLayout="@layout/${LAYOUT}"`));
    }
    return mod;
  });
};
