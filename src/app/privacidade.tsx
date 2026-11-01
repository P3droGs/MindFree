import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/buttons';
import { Screen } from '@/components/screen';
import { useI18n } from '@/i18n';
import { privacyPolicyFor } from '@/legal/privacy';
import { useAppTheme } from '@/theme/theme-provider';

/** A política de privacidade completa, dentro do app (por enquanto em português e inglês). */
export default function PrivacyScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, language } = useI18n();
  const { policy, translated } = privacyPolicyFor(language.code);

  return (
    <Screen>
      <BackButton onPress={() => router.back()} style={styles.back} />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('privacy.title')}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {policy.updated}
        </AppText>
        {!translated ? (
          <AppText variant="small" tone="secondary">
            {t('privacy.onlyIn')}
          </AppText>
        ) : null}
        <View style={[styles.draft, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="caption" tone="secondary">
            {policy.draft}
          </AppText>
        </View>
      </View>
      {policy.sections.map((section) => (
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
