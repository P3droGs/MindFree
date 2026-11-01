import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, PrimaryButton } from '@/components/buttons';
import { Screen, Spacer } from '@/components/screen';
import { useClock } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { handOffCapture } from '@/lib/capture-handoff';
import { parseTasks } from '@/lib/parse-tasks';
import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

export default function WriteScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const [text, setText] = useState('');
  const clock = useClock();
  const count = parseTasks(text, clock()).length;

  const save = () => {
    if (count === 0) {
      Alert.alert(t('write.emptyTitle'), t('write.emptyBody'));
      return;
    }
    handOffCapture({ via: 'texto', text: text.trim() });
    router.replace('/anotado');
  };

  return (
    <Screen>
      <BackButton onPress={() => router.back()} style={styles.back} />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('write.title')}
        </AppText>
        <AppText tone="secondary">{t('write.sub')}</AppText>
      </View>
      <View style={styles.field}>
        <AppText variant="bodyStrong">{t('write.label')}</AppText>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          maxLength={4000}
          accessibilityLabel={t('write.label')}
          placeholder={t('write.placeholder')}
          placeholderTextColor={theme.textSecondary}
          textAlignVertical="top"
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
        />
        <AppText variant="caption" tone="secondary">
          {count > 0 ? (count === 1 ? t('write.countOne') : t('write.countMany', { n: count })) : t('write.hint')}
        </AppText>
      </View>
      <Spacer />
      <PrimaryButton label={t('write.save')} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  intro: { gap: 8 },
  field: { gap: 8 },
  input: {
    minHeight: 200,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 24,
  },
});
