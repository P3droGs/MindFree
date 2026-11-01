import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PlanetAvatar } from '@/components/avatar';
import { BackButton } from '@/components/buttons';
import { OBS, ObsChip, ObservatoryScreen, useObsToast } from '@/components/observatory';
import { SocialGate } from '@/components/social-gate';
import { useT } from '@/i18n';
import { displayName, initialOf, planetColor, social, type BlockedPerson } from '@/lib/social';

export default function BlockedRoute() {
  return (
    <SocialGate>
      <BlockedScreen />
    </SocialGate>
  );
}

/** Quem você bloqueou. Desbloquear não volta a seguir: cada um decide se quer seguir de novo. */
function BlockedScreen() {
  const router = useRouter();
  const t = useT();
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useObsToast();

  const load = useCallback(async () => {
    try {
      setPeople(await social.blockedList());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unblock = (person: BlockedPerson) => {
    const name = displayName(person);
    Alert.alert(t('safety.unblockTitle', { name }), t('safety.unblockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('safety.unblock'),
        onPress: () => {
          setPeople((current) => current?.filter((p) => p.userId !== person.userId) ?? null);
          social.unblock(person.userId).catch(() => {
            setToast(t('social.offline'));
            void load();
          });
        },
      },
    ]);
  };

  return (
    <ObservatoryScreen dock={false} toast={toast}>
      <BackButton onPress={() => router.back()} style={styles.back} color={OBS.text} />
      <View style={styles.intro}>
        <AppText variant="display" accessibilityRole="header" style={{ color: OBS.text }}>
          {t('safety.blockedTitle')}
        </AppText>
        <AppText variant="small" style={{ color: OBS.muted }}>
          {t('safety.blockedSub')}
        </AppText>
      </View>
      {people?.map((person) => (
        <View key={person.userId} style={styles.person}>
          <PlanetAvatar initial={initialOf(person)} color={planetColor(person.userId)} size={42} lit={false} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" style={{ color: OBS.text }} numberOfLines={1}>
              {displayName(person)}
            </AppText>
            <AppText variant="caption" style={{ color: OBS.faint }} numberOfLines={1}>
              {`@${person.handle}`}
            </AppText>
          </View>
          <ObsChip label={t('safety.unblock')} onPress={() => unblock(person)} />
        </View>
      ))}
      {people && people.length === 0 ? (
        <AppText variant="small" style={{ color: OBS.soft }}>
          {t('safety.blockedEmpty')}
        </AppText>
      ) : null}
      {failed && !people ? (
        <View style={styles.notice}>
          <AppText variant="small" style={[styles.flex, { color: OBS.soft }]}>
            {t('social.offline')}
          </AppText>
          <ObsChip label={t('social.retry')} filled onPress={() => void load()} />
        </View>
      ) : null}
    </ObservatoryScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginLeft: -10 },
  intro: { gap: 6 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
