import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';

/** Lua + "MindFree", sempre clara: aparece por cima da ilustração da noite. */
export function BrandMark() {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="MindFree" style={styles.row}>
      <View style={styles.logo}>
        <Icon name="moon" size={20} color="#10142E" strokeWidth={2.4} />
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
    backgroundColor: '#B9A6FF',
    experimental_backgroundImage: 'linear-gradient(180deg, #C8BAFF 0%, #A991FF 100%)',
    boxShadow: '0px 8px 18px -8px rgba(169, 145, 255, 0.9)',
  },
  name: { fontSize: 21, lineHeight: 26, color: '#EEF0FF' },
});
