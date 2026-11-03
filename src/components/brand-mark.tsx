import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { LogoGlyph } from '@/components/logo-glyph';

/** O logo (o mesmo do ícone do app) + "MindFree", sempre claro: aparece por cima da ilustração da noite. */
export function BrandMark() {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="MindFree" style={styles.row}>
      <View style={styles.logo}>
        <LogoGlyph size={24} />
      </View>
      <AppText variant="title" style={styles.name}>
        MindFree
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    // O mesmo quadrado azul-noite do ícone, com uma borda lilás fina para não sumir no céu da ilustração.
    backgroundColor: '#141A48',
    experimental_backgroundImage: 'radial-gradient(circle at 50% 72%, #262C6E 0%, #141A48 60%, #0B0E24 100%)',
    borderWidth: 1,
    borderColor: 'rgba(199, 184, 255, 0.35)',
    boxShadow: '0px 8px 18px -8px rgba(0, 0, 0, 0.8)',
  },
  name: { fontSize: 21, lineHeight: 26, color: '#EEF0FF' },
});
