import { isRunningInExpoGo, reloadAppAsync } from 'expo';
import { Alert, I18nManager, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import {
  deviceLanguage,
  LANGUAGES,
  languageByCode,
  resolveLanguage,
  translator,
  useT,
  type LanguageSetting,
} from '@/i18n';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

/** Lista de idiomas que sobe de baixo. Ao escolher, o app troca na hora. */
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();

  const choose = (setting: LanguageSetting) => {
    update({ language: setting });
    onClose();
    // Árabe se lê da direita para a esquerda: o celular só vira o layout depois de reiniciar o app.
    // No Expo Go isso não funciona (ele desfaz a troca), então lá só o texto muda.
    const next = languageByCode(resolveLanguage(setting));
    if (Platform.OS !== 'web' && !isRunningInExpoGo() && next.rtl !== I18nManager.isRTL) {
      const say = translator(next.code);
      Alert.alert(say('lang.restartTitle'), say('lang.restartBody'), [
        { text: say('common.cancel'), style: 'cancel' },
        {
          text: say('lang.restart'),
          onPress: () => {
            I18nManager.allowRTL(next.rtl);
            I18nManager.forceRTL(next.rtl);
            void reloadAppAsync();
          },
        },
      ]);
    }
  };

  const options: { id: LanguageSetting; name: string; detail?: string }[] = [
    { id: 'device', name: t('lang.device'), detail: t('lang.deviceNow', { name: languageByCode(deviceLanguage()).native }) },
    ...LANGUAGES.map((language) => ({ id: language.code, name: language.native })),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 16 },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="title" accessibilityRole="header" style={styles.title}>
                {t('lang.title')}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {t('lang.hint')}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              style={[styles.close, { backgroundColor: theme.raised }]}>
              <Icon name="x" size={20} color={theme.text} strokeWidth={2.4} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {options.map((option) => {
              const selected = option.id === settings.language;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => choose(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: selected ? theme.raised : pressed ? theme.raised : 'transparent' },
                  ]}>
                  <View style={styles.optionText}>
                    <AppText variant="bodyStrong">{option.name}</AppText>
                    {option.detail ? (
                      <AppText variant="caption" tone="secondary">
                        {option.detail}
                      </AppText>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.radio,
                      selected ? { backgroundColor: theme.accent } : { borderWidth: 2, borderColor: theme.border },
                    ]}>
                    {selected ? <Icon name="check" size={13} color={theme.onAccent} strokeWidth={3.6} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Botão pequeno com o globo e a sigla do idioma (ex.: "PT"), para usar em cima da ilustração. */
export function LanguageButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const code = resolveLanguage(settings.language);
  const language = languageByCode(code);
  const name = settings.language === 'device' ? t('lang.device') : language.native;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('lang.button', { name })}
      onPress={onPress}
      style={({ pressed }) => [styles.languageButton, { opacity: pressed ? 0.75 : 1 }]}>
      <Icon name="globe" size={18} color="#EEF0FF" />
      <AppText variant="bodyStrong" style={styles.languageCode}>
        {language.short}
      </AppText>
      <Icon name="chevron-down" size={14} color="#EEF0FF" strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 7, 20, 0.62)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 22, lineHeight: 28 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 2, paddingBottom: 8 },
  option: { minHeight: 52, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { flex: 1, gap: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  languageButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(199, 184, 255, 0.35)',
    backgroundColor: 'rgba(16, 20, 46, 0.55)',
  },
  languageCode: { color: '#EEF0FF', fontSize: 14 },
});
