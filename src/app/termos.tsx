import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/buttons';
import { Screen } from '@/components/screen';
import { useI18n } from '@/i18n';
import { termsFor } from '@/legal/terms';
import { useAppTheme } from '@/theme/theme-provider';

/** Os termos de uso completos, dentro do app (por enquanto em português e inglês), iguais à política. */
export default function TermsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, language } = useI18n();
  const { terms, translated } = termsFor(language.code);

  return (
    <Screen>
      <BackButton onPress={() => router.back()} style={styles.back} />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('terms.title')}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {terms.updated}
        </AppText>
        {!translated ? (
          <AppText variant="small" tone="secondary">
            {t('terms.onlyIn')}
          </AppText>
        ) : null}
        <View style={[styles.draft, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="caption" tone="secondary">
            {terms.draft}
          </AppText>
        </View>
      </View>
      {terms.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {section.title}
          </AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph} variant="small" tone="secondary">
              {paragraph}
            </AppText>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  intro: { gap: 6 },
  draft: { marginTop: 6, padding: 12, borderRadius: 14, borderWidth: 1 },
  section: { gap: 8 },
});
