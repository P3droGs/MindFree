import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PlanetAvatar } from '@/components/avatar';
import { BackButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { OBS, ObsChip, ObservatoryScreen, useObsToast } from '@/components/observatory';
import { PersonActionsSheet, type PersonAction } from '@/components/person-actions-sheet';
import { SocialGate } from '@/components/social-gate';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { eveningDay } from '@/lib/capture';
import { forget, remembered } from '@/lib/remembered';
import { displayName, failureText, initialOf, planetColor, social, type FollowState, type Orbit, type Person } from '@/lib/social';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { fonts } from '@/theme/typography';

export default function OrbitRoute() {
  return (
    <SocialGate>
      <OrbitScreen />
    </SocialGate>
  );
}

/** A órbita: quem segue você (seguidores), quem você segue, os pedidos e a busca por gente nova. */
function OrbitScreen() {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings();
  const { profile, refresh } = useSocial();
  const today = eveningDay(useNow(), settings.morningMinutes);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'followers' | 'following'>(params.tab === 'following' ? 'following' : 'followers');
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  const [toast, setToast] = useObsToast();
  const [acting, setActing] = useState<{ person: Person; canRemove: boolean } | null>(null);
  const searching = query.trim().replace(/^@+/, '').length >= 2;

  // Depois de remover, bloquear ou denunciar: fecha a folha, avisa e atualiza a lista e os números.
  const afterAction = (action: PersonAction) => {
    setActing(null);
    const text: Record<PersonAction, string> = {
      removed: t('safety.removed'),
      blocked: t('safety.blocked'),
      reported: t('safety.reported'),
      failed: t('social.offline'),
    };
    setToast(text[action]);
    if (action === 'failed') return;
    forget();
    if (action === 'blocked') setResults((current) => current?.filter((p) => p.userId !== acting?.person.userId) ?? null);
    void load(true);
    void refresh();
  };

  const load = useCallback(async (fresh = false) => {
    try {
      setOrbit(await remembered(`orbit.${today}`, () => social.orbit(today), fresh));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A busca espera a pessoa parar de digitar um instante antes de perguntar ao servidor.
  useEffect(() => {
    if (!searching) return;
    let active = true;
    const timeout = setTimeout(() => {
      social
        .search(query, today)
        .then((found) => {
          if (active) setResults(found);
        })
        .catch((error) => {
          if (active) setToast(failureText(error, t));
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query, searching, today, t, setToast]);

  /** Muda o "seguir" de uma pessoa em todas as listas da tela de uma vez. */
  const setFollow = (userId: string, iFollow: FollowState) => {
    const patch = (list: Person[]) => list.map((person) => (person.userId === userId ? { ...person, iFollow } : person));
    setOrbit((current) =>
      current
        ? {
            followers: patch(current.followers),
            following:
              iFollow === 'none'
                ? current.following.filter((person) => person.userId !== userId)
                : patch(current.following),
            requests: current.requests,
          }
        : current,
    );
    setResults((current) => (current ? patch(current) : current));
  };

  const follow = (person: Person) => {
    setFollow(person.userId, person.private ? 'pending' : 'accepted');
    social
      .follow(person.userId)
      .then((state) => {
        setFollow(person.userId, state);
        forget();
        void load(true);
        void refresh();
      })
      .catch((error) => {
        setFollow(person.userId, 'none');
        setToast(failureText(error, t));
      });
  };

  const unfollow = (person: Person) => {
    const name = displayName(person);
    const pending = person.iFollow === 'pending';
    Alert.alert(
      pending ? t('orbit.cancelTitle', { name }) : t('orbit.unfollowTitle', { name }),
      pending ? undefined : t('orbit.unfollowBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: pending ? t('orbit.cancelRequest') : t('orbit.unfollow'),
          style: 'destructive',
          onPress: () => {
            const before = person.iFollow;
            setFollow(person.userId, 'none');
            social
              .unfollow(person.userId)
              .then(() => {
                forget();
                return refresh();
              })
              .catch((error) => {
                setFollow(person.userId, before);
                setToast(failureText(error, t));
              });
          },
        },
      ],
    );
  };

  const respond = (person: Person, accept: boolean) => {
    setOrbit((current) =>
      current
        ? {
            ...current,
            requests: current.requests.filter((request) => request.userId !== person.userId),
            followers: accept ? [{ ...person, followsMe: true }, ...current.followers] : current.followers,
          }
        : current,
    );
    social
      .respond(person.userId, accept)
      .then(() => {
        forget();
        return refresh();
      })
      .catch((error) => {
        setToast(failureText(error, t));
        void load(true);
      });
  };

  const followButton = (person: Person, followBack: boolean) => {
    const name = displayName(person);
    if (person.iFollow === 'accepted') {
      return (
        <ObsChip
          label={t('orbit.following')}
          selected
          accessibilityLabel={t('orbit.unfollowLabel', { name })}
          onPress={() => unfollow(person)}
        />
      );
    }
    if (person.iFollow === 'pending') {
      return (
        <ObsChip
          label={t('orbit.requested')}
          selected
          accessibilityLabel={t('orbit.requestedLabel', { name })}
          onPress={() => unfollow(person)}
        />
      );
    }
    return (
      <ObsChip
        label={followBack ? t('orbit.followBack') : t('orbit.follow')}
        filled
        accessibilityLabel={followBack ? t('orbit.followBackLabel', { name }) : t('orbit.followLabel', { name })}
        onPress={() => follow(person)}
      />
    );
  };

  const followers = orbit?.followers ?? [];
  const following = orbit?.following ?? [];
  const requests = orbit?.requests ?? [];
  const followingCount = following.filter((person) => person.iFollow === 'accepted').length;

  return (
    <ObservatoryScreen toast={toast}>
      <View style={styles.top}>
        <BackButton onPress={() => router.back()} color={OBS.text} style={styles.back} />
        <AppText variant="bodyStrong" style={{ color: OBS.faint }}>
          {profile ? `@${profile.handle}` : ''}
        </AppText>
      </View>
      <AppText variant="display" accessibilityRole="header" style={{ color: OBS.text }}>
        {t('orbit.title')}
      </AppText>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['followers', 'following'] as const).map((value) => {
          const selected = tab === value && !searching;
          const count = value === 'followers' ? followers.length : followingCount;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                setTab(value);
                setQuery('');
              }}
              style={[styles.tab, selected && { backgroundColor: OBS.lilac }]}>
              <AppText variant="timeSmall" style={{ color: selected ? OBS.ink : OBS.text, fontSize: 18, lineHeight: 22 }}>
                {String(count)}
              </AppText>
              <AppText variant="caption" style={[styles.bold, { color: selected ? OBS.ink : OBS.soft }]}>
                {value === 'followers'
                  ? t(count === 1 ? 'profile.followersOne' : 'profile.followers')
                  : t(count === 1 ? 'profile.followingOne' : 'profile.following')}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={OBS.faint} />
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (value.trim().replace(/^@+/, '').length < 2) setResults(null);
          }}
          placeholder={t('orbit.search')}
          placeholderTextColor={OBS.faint}
          accessibilityLabel={t('orbit.search')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      {searching ? (
        <View style={styles.list}>
          <AppText variant="label" style={{ color: OBS.faint }}>
            {t('orbit.results')}
          </AppText>
          {results?.map((person) => (
            <PersonRow key={person.userId} person={person} onMore={() => setActing({ person, canRemove: person.followsMe })}>
              {followButton(person, person.followsMe)}
            </PersonRow>
          ))}
          {results && results.length === 0 ? <Empty text={t('orbit.noResults')} /> : null}
        </View>
      ) : (
        <>
          {tab === 'followers' && requests.length > 0 ? (
            <View style={styles.requests}>
              <AppText variant="bodyStrong" style={{ color: OBS.goldText }}>
                {t('orbit.requests', { n: requests.length })}
              </AppText>
              {requests.map((person) => (
                <PersonRow key={person.userId} person={person} onMore={() => setActing({ person, canRemove: false })}>
                  <ObsChip label={t('orbit.accept')} filled onPress={() => respond(person, true)} />
                  <ObsChip label={t('orbit.decline')} onPress={() => respond(person, false)} />
                </PersonRow>
              ))}
            </View>
          ) : null}

          <View style={styles.list}>
            {tab === 'followers'
              ? followers.map((person) => (
                  <PersonRow key={person.userId} person={person} onMore={() => setActing({ person, canRemove: true })}>
                    {followButton(person, true)}
                  </PersonRow>
                ))
              : following.map((person) => (
                  <PersonRow key={person.userId} person={person} onMore={() => setActing({ person, canRemove: person.followsMe })}>
                    {followButton(person, false)}
                  </PersonRow>
                ))}
            {orbit && tab === 'followers' && followers.length === 0 && requests.length === 0 ? (
              <Empty text={t('orbit.noFollowers')} />
            ) : null}
            {orbit && tab === 'following' && following.length === 0 ? <Empty text={t('orbit.noFollowing')} /> : null}
            {failed && !orbit ? (
              <View style={styles.notice}>
                <AppText variant="small" style={[styles.flex, { color: OBS.soft }]}>
                  {t('social.offline')}
                </AppText>
                <ObsChip label={t('social.retry')} filled onPress={() => void load(true)} />
              </View>
            ) : null}
          </View>
        </>
      )}


      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/convidar')}
        style={({ pressed }) => [styles.invite, { opacity: pressed ? 0.75 : 1 }]}>
        <Icon name="user-plus" size={20} color={OBS.goldText} />
        <AppText variant="bodyStrong" style={{ color: OBS.text }}>
          {t('orbit.invite')}
        </AppText>
      </Pressable>
      <PersonActionsSheet
        person={acting?.person ?? null}
        canRemove={!!acting?.canRemove}
        onClose={() => setActing(null)}
        onDone={afterAction}
      />
    </ObservatoryScreen>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <AppText variant="small" style={{ color: OBS.soft }}>
      {text}
    </AppText>
  );
}

function PersonRow({ person, children, onMore }: { person: Person; children: ReactNode; onMore: () => void }) {
  const t = useT();
  const details = [`@${person.handle}`];
  if (person.starsMonth !== null) {
    details.push(person.starsMonth === 1 ? t('sky.starsOne') : t('orbit.stars', { n: person.starsMonth }));
  }
  return (
    <View style={styles.person}>
      <PlanetAvatar initial={initialOf(person)} color={planetColor(person.userId)} size={42} lit={person.litToday === true} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <AppText variant="bodyStrong" style={{ color: OBS.text }} numberOfLines={1}>
            {displayName(person)}
          </AppText>
          {person.private ? <Icon name="lock" size={12} color={OBS.faint} strokeWidth={2.6} /> : null}
        </View>
        <AppText variant="caption" style={{ color: OBS.faint }} numberOfLines={1}>
          {details.join(' · ')}
        </AppText>
      </View>
      {children}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('safety.moreLabel', { name: displayName(person) })}
        hitSlop={6}
        onPress={onMore}
        style={styles.more}>
        <Icon name="more" size={20} color={OBS.muted} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  more: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  bold: { fontFamily: fonts.extraBold },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { marginLeft: -10 },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 22,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  tab: { flex: 1, minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  searchInput: { flex: 1, minHeight: 46, color: OBS.text, fontFamily: fonts.semiBold, fontSize: 16 },
  requests: {
    gap: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: OBS.cardMine,
    borderWidth: 1,
    borderColor: OBS.cardMineBorder,
  },
  list: { gap: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: OBS.ringOff,
  },
});
