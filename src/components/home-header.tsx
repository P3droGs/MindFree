import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ProfileBadge } from '@/components/avatar';
import { IconButton } from '@/components/buttons';
import { LogoGlyph } from '@/components/logo-glyph';
import { useT } from '@/i18n';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { useAppTheme } from '@/theme/theme-provider';

/** Topo da tela inicial: marca, amigos, calendário, ajustes e a foto do perfil. */
export function HomeHeader() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { settings } = useSettings();
  const { profile } = useSocial();
  const initial = (settings.name.trim()[0] ?? 'M').toLocaleUpperCase();
  // O pontinho nos amigos: alguém está esperando você aprovar a entrada na sua órbita.
  const hasRequests = (profile?.requests ?? 0) > 0;

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        {/* O mesmo quadrado azul-noite do ícone do app: aparece igual de noite e de manhã. */}
        <View style={styles.logo}>
          <LogoGlyph size={18} />
        </View>
        <AppText variant="heading" style={styles.brandName}>
          MindFree
        </AppText>
      </View>
      <View style={styles.actions}>
        <View>
          <IconButton
            icon="users"
            label={hasRequests ? `${t('home.friends')} · ${t('orbit.requests', { n: profile?.requests ?? 0 })}` : t('home.friends')}
            onPress={() => router.push('/amigos')}
          />
          {hasRequests ? <View pointerEvents="none" style={[styles.dot, { borderColor: theme.background }]} /> : null}
        </View>
        <IconButton icon="calendar" label={t('calendar.title')} onPress={() => router.push('/calendario')} />
        <IconButton icon="sliders" label={t('home.settings')} onPress={() => router.push('/ajustes')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.yours')}
          hitSlop={4}
          onPress={() => router.push('/perfil')}
          style={({ pressed }) => [styles.profile, { opacity: pressed ? 0.7 : 1 }]}>
          <ProfileBadge initial={initial} background={theme.background} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 19 },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141A48',
    experimental_backgroundImage: 'radial-gradient(circle at 50% 72%, #262C6E 0%, #141A48 60%, #0B0E24 100%)',
  },
  actions: { flexDirection: 'row', alignItems: 'center', marginRight: -6 },
  dot: {
    position: 'absolute',
    top: 9,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: '#FFC857',
  },
  profile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
