import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { LinkButton, PrimaryButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import { CONSTELLATION_NAME_MAX, customName, suggestedName, type MonthKey } from '@/lib/constellations';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

/** Folha que sobe de baixo para dar outro nome à constelação de um mês (ou voltar ao nome sugerido). */
export function ConstellationSheet({ month, monthLabel, onClose }: { month: MonthKey | null; monthLabel: string; onClose: () => void }) {
  return (
    <Modal visible={!!month} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {month ? <SheetBody key={month} month={month} monthLabel={monthLabel} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetBody({ month, monthLabel, onClose }: { month: MonthKey; monthLabel: string; onClose: () => void }) {
  const theme = useAppTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const suggested = suggestedName(t, month);
  const custom = customName(settings.constellationNames, month);
  const [name, setName] = useState(custom || suggested);

  const save = (next: string) => {
    const clean = next.trim().slice(0, CONSTELLATION_NAME_MAX);
    const names = { ...settings.constellationNames };
    // Igual ao sugerido (ou vazio) não precisa ser guardado: o app já sabe esse nome.
    if (!clean || clean === suggested) delete names[month];
    else names[month] = clean;
    update({ constellationNames: names });
    onClose();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={styles.backdrop} />
      <View
        accessibilityViewIsModal
        style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="title" accessibilityRole="header" style={styles.title}>
              {t('sky.renameTitle')}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {t('sky.renameHint', { month: monthLabel })}
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
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel={t('sky.renameTitle')}
          placeholder={suggested}
          placeholderTextColor={theme.textSecondary}
          maxLength={CONSTELLATION_NAME_MAX}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={() => save(name)}
          style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
        />
        <PrimaryButton label={t('common.save')} onPress={() => save(name)} />
        {custom ? (
          <LinkButton label={t('sky.renameSuggested', { name: suggested })} align="center" onPress={() => save('')} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 7, 20, 0.62)' },
  sheet: {
    gap: 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 6 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 22, lineHeight: 28 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, fontFamily: fonts.semiBold, fontSize: 17 },
});
