import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polyline } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { PlanetAvatar } from '@/components/avatar';
import { BackButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { OBS, ObsChip, ObservatoryScreen, Sparkle, useObsToast } from '@/components/observatory';
import { SocialGate } from '@/components/social-gate';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { eveningDay } from '@/lib/capture';
import { forget, remembered } from '@/lib/remembered';
import { displayName, failureText, initialOf, planetColor, social, type Friend } from '@/lib/social';
import { addDays, mondayOf, nightOfDay, weekNights } from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { SKY_CONSTELLATIONS } from '@/social/sky';

const SKY_WIDTH = 350;
const SKY_HEIGHT = 236;

type Person = {
  id: string;
  name: string;
  initial: string;
  color: string;
  days: boolean[];
  today: boolean;
  me: boolean;
  shined: boolean;
  poked: boolean;
};

export default function FriendsSkyRoute() {
  return (
    <SocialGate>
      <FriendsSkyScreen />
    </SocialGate>
  );
}

/** O céu da semana: a sua constelação e a de cada pessoa que você segue, uma estrela por noite acesa. */
function FriendsSkyScreen() {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings();
  const { journal } = useJournal();
  const { profile } = useSocial();
  const { width: screenWidth } = useWindowDimensions();
  const skyWidth = Math.min(screenWidth - 40, 480);
  const now = useNow();
  const tonight = eveningDay(now, settings.morningMinutes);
  const monday = mondayOf(tonight);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useObsToast();

  const load = useCallback(async (fresh = false) => {
    try {
      setFriends(await remembered(`friends.${monday}.${tonight}`, () => social.friendsWeek(monday, tonight), fresh));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [monday, tonight]);

  // Toda vez que a tela abre, busca a semana de novo (alguém pode ter acendido a estrela).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const myName = settings.name.trim().split(' ')[0];
  const me: Person = {
    id: 'voce',
    name: t('friends.you'),
    initial: (myName[0] ?? profile?.handle[0] ?? 'M').toLocaleUpperCase(),
    color: '#C7B8FF',
    days: weekNights(journal, tonight),
    today: !!nightOfDay(journal, tonight),
    me: true,
    shined: false,
    poked: false,
  };
  const people: Person[] = [
    me,
    ...(friends ?? []).map((friend) => ({
      id: friend.userId,
      name: displayName(friend),
      initial: initialOf(friend),
      color: planetColor(friend.userId),
      days: [0, 1, 2, 3, 4, 5, 6].map((offset) => friend.days.includes(addDays(monday, offset))),
      today: friend.days.includes(tonight),
      me: false,
      shined: friend.shined,
      poked: friend.poked,
    })),
  ];
  const total = people.reduce((sum, person) => sum + person.days.filter(Boolean).length, 0);
  const alone = people.length === 1;
  // A estrela cadente aparece para quem convidou alguém ou entrou por convite.
  const shootingStar = !!profile && (profile.invites > 0 || profile.invited);

  const setFriend = (id: string, changes: Partial<Friend>) =>
    setFriends((current) => current?.map((friend) => (friend.userId === id ? { ...friend, ...changes } : friend)) ?? null);

  const shine = (person: Person) => {
    const on = !person.shined;
    setFriend(person.id, { shined: on });
    setToast(on ? t('friends.shineSent', { name: person.name }) : '');
    forget('friends.');
    social.interact(person.id, 'shine', tonight, on).catch((error) => {
      setFriend(person.id, { shined: !on });
      setToast(failureText(error, t));
    });
  };

  const poke = (person: Person) => {
    if (person.poked) return;
    setFriend(person.id, { poked: true });
    setToast(t('friends.pokeSent', { name: person.name }));
    forget('friends.');
    social.interact(person.id, 'poke', tonight, true).catch((error) => {
      setFriend(person.id, { poked: false });
      setToast(failureText(error, t));
    });
  };

  return (
    <ObservatoryScreen toast={toast}>
      <View style={styles.top}>
        <BackButton onPress={() => router.back()} color={OBS.text} style={styles.back} />
        <AppText variant="label" style={{ color: OBS.faint }}>
          {t('friends.week')}
        </AppText>
      </View>

      <View style={styles.intro}>
        <AppText variant="display" accessibilityRole="header" style={{ color: OBS.text }}>
          {t('friends.title')}
        </AppText>
        <AppText variant="small" style={{ color: OBS.muted }}>
          {alone
            ? t('friends.alone', { n: total })
            : total === 1
              ? t('friends.togetherOne')
              : t('friends.together', { n: total })}
        </AppText>
      </View>

      {profile && profile.requests > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/orbita', params: { tab: 'followers' } })}
          style={({ pressed }) => [styles.requests, { opacity: pressed ? 0.8 : 1 }]}>
          <View style={styles.requestsDot} />
          <AppText variant="bodyStrong" style={[styles.flex, { color: OBS.goldText }]}>
            {t('orbit.requests', { n: profile.requests })}
          </AppText>
          <Icon name="chevron-right" size={18} color={OBS.goldText} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      <View style={[styles.sky, { height: (skyWidth / SKY_WIDTH) * SKY_HEIGHT }]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SKY_WIDTH} ${SKY_HEIGHT}`}
          accessibilityLabel={t('friends.skyLabel')}>
          <Path d="M30 236 A 145 145 0 0 1 320 236" fill="none" stroke="#2A3275" strokeWidth={1} strokeDasharray="2 6" />
          <Path d="M70 236 A 105 105 0 0 1 280 236" fill="none" stroke="#2A3275" strokeWidth={1} strokeDasharray="2 6" />
          <Circle cx={175} cy={34} r={1.2} fill="#EEF0FF" opacity={0.5} />
          <Circle cx={96} cy={70} r={1} fill="#EEF0FF" opacity={0.4} />
          <Circle cx={262} cy={66} r={1} fill="#EEF0FF" opacity={0.4} />
          {people.map((person, index) => {
            const style = SKY_CONSTELLATIONS[index % SKY_CONSTELLATIONS.length];
            const points = style.points.slice(0, person.days.filter(Boolean).length);
            return <Constellation key={person.id} points={points} color={style.color} star={style.star} />;
          })}
          {shootingStar ? (
            <>
              <Path d="M268 30 L314 18" stroke="#FFF4D6" strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
              <Circle cx={314} cy={18} r={3} fill="#FFF4D6" />
            </>
          ) : null}
        </Svg>
        <View style={styles.legend} pointerEvents="none">
          {people.map((person, index) => {
            const color = SKY_CONSTELLATIONS[index % SKY_CONSTELLATIONS.length].color;
            return (
              <View key={person.id} style={[styles.legendChip, { backgroundColor: `${color}29` }]}>
                <AppText variant="caption" style={[styles.legendText, { color }]}>
                  {person.name}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" style={{ color: OBS.text }}>
          {t('friends.orbits')}
        </AppText>
        {people.map((person) => {
          const stars = person.days.filter(Boolean).length;
          let status = person.today ? t('friends.litToday') : t('friends.notYet');
          if (person.today && person.shined) status = t('friends.youShone');
          return (
            <View
              key={person.id}
              style={[
                styles.row,
                person.me
                  ? { backgroundColor: OBS.cardMine, borderColor: OBS.cardMineBorder }
                  : { backgroundColor: OBS.card, borderColor: OBS.cardBorder },
              ]}>
              <View style={styles.rowTop}>
                <PlanetAvatar initial={person.initial} color={person.color} lit={person.today} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" style={{ color: OBS.text }}>
                    {person.name}
                  </AppText>
                  <AppText variant="caption" style={{ color: OBS.muted }}>
                    {status}
                  </AppText>
                </View>
                {!person.me && person.today ? (
                  <ObsChip
                    label={person.shined ? t('friends.sent') : t('friends.shine')}
                    gold={person.shined}
                    selected={person.shined}
                    icon={<Sparkle size={14} color={person.shined ? OBS.ink : OBS.goldText} />}
                    accessibilityLabel={
                      person.shined
                        ? t('friends.unshineLabel', { name: person.name })
                        : t('friends.shineLabel', { name: person.name })
                    }
                    onPress={() => shine(person)}
                  />
                ) : null}
                {!person.me && !person.today ? (
                  <ObsChip
                    label={person.poked ? t('friends.poked') : t('friends.poke')}
                    filled={!person.poked}
                    accessibilityLabel={t('friends.pokeLabel', { name: person.name })}
                    onPress={() => poke(person)}
                  />
                ) : null}
              </View>
              <View style={styles.weekRow}>
                <Svg
                  width={226}
                  height={14}
                  viewBox="0 0 226 14"
                  accessibilityLabel={t('friends.weekLabel', { name: person.name, n: stars })}>
                  <Line x1={7} y1={7} x2={219} y2={7} stroke="#262D63" strokeWidth={2} />
                  {person.days.map((lit, index) => (
                    <Circle key={index} cx={7 + index * 35.33} cy={7} r={lit ? 5 : 3} fill={lit ? person.color : OBS.track} />
                  ))}
                </Svg>
                <AppText variant="bodyStrong" style={styles.weekCount}>
                  {`${stars} / 7`}
                </AppText>
              </View>
            </View>
          );
        })}
        {failed && friends === null ? (
          <View style={styles.notice}>
            <AppText variant="small" style={[styles.flex, { color: OBS.soft }]}>
              {t('social.offline')}
            </AppText>
            <ObsChip label={t('social.retry')} filled onPress={() => void load(true)} />
          </View>
        ) : null}
        {friends !== null && friends.length === 0 ? (
          <AppText variant="small" style={{ color: OBS.soft }}>
            {t('friends.empty')}
          </AppText>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/convidar')}
        style={({ pressed }) => [styles.invite, { opacity: pressed ? 0.8 : 1 }]}>
        <Svg width={52} height={52} viewBox="0 0 52 52">
          <Ellipse
            cx={26}
            cy={28}
            rx={25}
            ry={8}
            fill="none"
            stroke={OBS.gold}
            strokeWidth={2}
            strokeDasharray="3 4"
            transform="rotate(-18 26 28)"
          />
          <Circle cx={26} cy={26} r={15} fill={OBS.raised} stroke={OBS.ringOff} strokeWidth={1.5} />
          <Line x1={26} y1={20} x2={26} y2={32} stroke="#C7B8FF" strokeWidth={2.4} strokeLinecap="round" />
          <Line x1={20} y1={26} x2={32} y2={26} stroke="#C7B8FF" strokeWidth={2.4} strokeLinecap="round" />
        </Svg>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" style={{ color: OBS.text }}>
            {t('friends.inviteTitle')}
          </AppText>
          <AppText variant="caption" style={{ color: OBS.soft }}>
            {t('friends.inviteSub')}
          </AppText>
        </View>
      </Pressable>

      <View style={styles.privacy}>
        <Icon name="lock" size={16} color={OBS.faint} />
        <AppText variant="caption" style={[styles.flex, { color: OBS.faint }]}>
          {t('friends.privacy')}
        </AppText>
      </View>
    </ObservatoryScreen>
  );
}

function Constellation({ points, color, star }: { points: [number, number][]; color: string; star: string }) {
  if (points.length === 0) return null;
  return (
    <>
      {points.length > 1 ? (
        <Polyline
          points={points.map((point) => point.join(',')).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeOpacity={0.55}
        />
      ) : null}
      {points.map(([cx, cy]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.4} fill={star} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { marginLeft: -10 },
  intro: { gap: 4 },
  requests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: OBS.cardMine,
    borderWidth: 1,
    borderColor: OBS.cardMineBorder,
  },
  requestsDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: OBS.gold },
  sky: {
    borderTopLeftRadius: 175,
    borderTopRightRadius: 175,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderColor: '#262D63',
    backgroundColor: '#0E1233',
    experimental_backgroundImage: 'radial-gradient(circle at 50% 100%, #1C2258 0%, #0E1233 55%, #070A1C 100%)',
    overflow: 'hidden',
  },
  legend: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  legendChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  legendText: { fontSize: 11, lineHeight: 15 },
  section: { gap: 10 },
  row: { gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekCount: { marginLeft: 'auto', color: OBS.goldText, fontVariant: ['tabular-nums'] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#141A42',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: OBS.ringOff,
  },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
