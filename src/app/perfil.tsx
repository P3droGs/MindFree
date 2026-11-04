import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { OBS, ObservatoryScreen, Sparkle } from '@/components/observatory';
import { SocialGate } from '@/components/social-gate';
import { useNow } from '@/hooks/use-now';
import { useT, type MessageKey } from '@/i18n';
import { eveningDay } from '@/lib/capture';
import { monthName, timeAgo } from '@/lib/dates';
import {
  displayName as personName,
  initialOf,
  isValidHandle,
  normalizeHandle,
  planetColor,
  social,
  SocialError,
  type Activity,
} from '@/lib/social';
import { remembered } from '@/lib/remembered';
import { dateFromKey, nightStreak, starsInMonth } from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { usePosts } from '@/state/posts';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { fonts } from '@/theme/typography';

const ACTIVITY_TEXT: Record<Activity['kind'], MessageKey> = {
  shine: 'profile.shinedYou',
  poke: 'profile.poked',
  follow: 'profile.joinedOrbit',
};

/** O vão entre os quadrinhos das conquistas, em px. */
const GRID_GAP = 8;

export default function ProfileRoute() {
  return (
    <SocialGate>
      <ProfileScreen />
    </SocialGate>
  );
}

/** O perfil: o planeta da pessoa, as luas de cada mês, as conquistas postadas e os brilhos. */
function ProfileScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const { profile, saveHandle } = useSocial();
  const { journal } = useJournal();
  const posts = usePosts();
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [handleError, setHandleError] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(settings.name);
  const [bio, setBio] = useState(settings.bio);
  const [tab, setTab] = useState<'grid' | 'shine'>('grid');
  // A largura da grade das conquistas, medida na tela: cada quadrinho é um terço dela, com 8 px de vão.
  // (Com `aspectRatio` e largura em %, o quadrinho saía com 5 px de altura numa linha que quebra.)
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - 2 * GRID_GAP) / 3) : 0;
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [activityFailed, setActivityFailed] = useState(false);
  const now = useNow();
  const tonight = eveningDay(now, settings.morningMinutes);
  const tonightDate = dateFromKey(tonight);
  const stars = starsInMonth(journal, tonightDate);
  const streak = nightStreak(journal, tonight);
  const displayName = settings.name.trim() || t('friends.you');
  const initial = (settings.name.trim()[0] ?? 'M').toLocaleUpperCase();
  const months = [0, 1, 2, 3].map((back) => {
    const date = new Date(tonightDate.getFullYear(), tonightDate.getMonth() - back, 1);
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: monthName(t, date.getMonth()), stars: starsInMonth(journal, date), days, current: back === 0 };
  });

  // Os brilhos, cutucões e quem entrou na órbita: busca toda vez que a tela abre.
  const loadActivity = useCallback(async () => {
    try {
      setActivity(await remembered('activity', () => social.activity()));
      setActivityFailed(false);
    } catch {
      setActivityFailed(true);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void loadActivity();
    }, [loadActivity]),
  );

  const startEditing = () => {
    setHandle(profile?.handle ?? '');
    setHandleError(null);
    setName(settings.name);
    setBio(settings.bio);
    setEditing(!editing);
  };

  const save = async () => {
    // Nome, bio e conta privada ficam nos Ajustes (o perfil público acompanha sozinho); o @ vai direto.
    update({ name: name.trim() || settings.name, bio: bio.trim() });
    const clean = normalizeHandle(handle);
    if (profile && clean !== profile.handle) {
      if (!isValidHandle(clean)) {
        setHandleError('social.handleHint');
        return;
      }
      setSaving(true);
      try {
        await saveHandle(clean);
      } catch (failure) {
        const reason = failure instanceof SocialError ? failure.failure : 'unknown';
        setHandleError(
          reason === 'handle_taken' ? 'social.handleTaken' : reason === 'handle_invalid' ? 'social.handleHint' : 'social.offline',
        );
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setEditing(false);
  };

  return (
    <ObservatoryScreen edgeToEdge>
      <View style={[styles.hero, { height: 232 + insets.top }]}>
        <View style={[styles.heroSky, { height: 204 + insets.top }]}>
          <Svg width="100%" height="100%" viewBox="0 0 390 232" preserveAspectRatio="xMidYMax slice">
            <Polyline
              points="64,170 98,128 140,150 176,108 214,132 252,100 292,124 330,96"
              fill="none"
              stroke="#C7B8FF"
              strokeWidth={1.2}
              strokeOpacity={0.55}
            />
            {[
              [64, 170],
              [98, 128],
              [140, 150],
              [176, 108],
              [214, 132],
              [252, 100],
              [292, 124],
              [330, 96],
            ].map(([cx, cy]) => (
              <Circle key={cx} cx={cx} cy={cy} r={3} fill="#FFF4D6" />
            ))}
          </Svg>
        </View>
        <View style={[styles.heroBar, { top: insets.top + 8 }]}>
          <HeroButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />
          <View style={styles.handle}>
            {settings.privateAccount ? <Icon name="lock" size={13} color={OBS.text} strokeWidth={2.6} /> : null}
            <AppText variant="bodyStrong" style={{ color: OBS.text }}>
              {profile ? `@${profile.handle}` : ''}
            </AppText>
          </View>
          <HeroButton icon="sliders" label={t('home.settings')} onPress={() => router.push('/ajustes')} />
        </View>
        <View style={styles.planet}>
          <Svg width={128} height={128} viewBox="0 0 128 128" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="planeta" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFB8CF" />
                <Stop offset="1" stopColor="#B9A6FF" />
              </LinearGradient>
            </Defs>
            <Ellipse cx={64} cy={68} rx={62} ry={18} fill="none" stroke={OBS.gold} strokeWidth={3} transform="rotate(-18 64 68)" />
            <Circle cx={64} cy={64} r={44} fill="url(#planeta)" stroke={OBS.background} strokeWidth={4} />
            <Path d="M2 68 A 62 18 0 0 0 126 68" fill="none" stroke={OBS.gold} strokeWidth={3} transform="rotate(-18 64 68)" />
          </Svg>
          <AppText style={styles.planetLetter}>{initial}</AppText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.identity}>
          <AppText variant="title" accessibilityRole="header" style={[styles.center, { color: OBS.text }]}>
            {displayName}
          </AppText>
          <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
            {settings.bio || t('profile.bioEmpty')}
          </AppText>
          <View style={styles.badges}>
            <View style={[styles.badge, styles.badgeGold]}>
              <Sparkle size={13} />
              <AppText variant="caption" style={[styles.badgeText, { color: OBS.goldText }]}>
                {stars === 1
                  ? t('profile.starsOne', { month: monthName(t, tonightDate.getMonth()) })
                  : t('profile.starsMany', { n: stars, month: monthName(t, tonightDate.getMonth()) })}
              </AppText>
            </View>
            {streak > 1 ? (
              <View style={[styles.badge, styles.badgeLilac]}>
                <Icon name="moon" size={13} color={OBS.lilacText} strokeWidth={2.4} />
                <AppText variant="caption" style={[styles.badgeText, { color: OBS.lilacText }]}>
                  {t('profile.streak', { n: streak })}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.stats}>
          <StatButton value={posts.length} label={t('profile.achievements')} onPress={() => setTab('grid')} />
          <View style={styles.statDivider} />
          <StatButton
            value={profile?.followers ?? 0}
            label={t('profile.inOrbit')}
            sub={t(profile?.followers === 1 ? 'profile.followersOne' : 'profile.followers')}
            onPress={() => router.push({ pathname: '/orbita', params: { tab: 'followers' } })}
          />
          <View style={styles.statDivider} />
          <StatButton
            value={profile?.following ?? 0}
            label={t('profile.youOrbit')}
            sub={t(profile?.following === 1 ? 'profile.followingOne' : 'profile.following')}
            onPress={() => router.push({ pathname: '/orbita', params: { tab: 'following' } })}
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: editing }}
            onPress={startEditing}
            style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.85 : 1 }]}>
            <AppText variant="bodyStrong" style={{ color: OBS.ink }}>
              {t('profile.edit')}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/convidar')}
            style={({ pressed }) => [styles.inviteButton, { opacity: pressed ? 0.75 : 1 }]}>
            <AppText variant="bodyStrong" style={{ color: OBS.text }}>
              {t('profile.invite')}
            </AppText>
          </Pressable>
        </View>

        {editing ? (
          <View style={styles.editCard}>
            <AppText variant="caption" style={styles.fieldLabel}>
              {t('social.handleLabel')}
            </AppText>
            <View style={[styles.handleInput, handleError && { borderColor: OBS.danger }]}>
              <AppText variant="bodyStrong" style={{ color: OBS.faint }}>
                @
              </AppText>
              <TextInput
                value={handle}
                onChangeText={(value) => {
                  setHandle(value.replace(/^@+/, ''));
                  setHandleError(null);
                }}
                accessibilityLabel={t('social.handleLabel')}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                style={styles.handleText}
              />
            </View>
            {handleError ? (
              <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: OBS.danger }}>
                {t(handleError)}
              </AppText>
            ) : null}
            <AppText variant="caption" style={styles.fieldLabel}>
              {t('profile.name')}
            </AppText>
            <TextInput value={name} onChangeText={setName} accessibilityLabel={t('profile.name')} style={styles.input} />
            <AppText variant="caption" style={styles.fieldLabel}>
              {t('profile.bio')}
            </AppText>
            <TextInput
              value={bio}
              onChangeText={setBio}
              maxLength={80}
              placeholder={t('profile.bioPlaceholder')}
              placeholderTextColor={OBS.faint}
              accessibilityLabel={t('profile.bio')}
              style={styles.input}
            />
            <View style={styles.privateRow}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" style={{ color: OBS.text }}>
                  {t('profile.private')}
                </AppText>
                <AppText variant="caption" style={{ color: OBS.muted }}>
                  {settings.privateAccount ? t('profile.privateOn') : t('profile.privateOff')}
                </AppText>
              </View>
              <Switch
                value={settings.privateAccount}
                onValueChange={(value) => update({ privateAccount: value })}
                accessibilityLabel={t('profile.private')}
                trackColor={{ true: OBS.lilac, false: '#3A4070' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void save()}
              style={({ pressed }) => [styles.saveButton, { opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}>
              <AppText variant="bodyStrong" style={{ color: OBS.ink }}>
                {saving ? t('auth.working') : t('common.save')}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="bodyStrong" style={[styles.sectionTitle, { color: OBS.soft }]}>
            {t('profile.moons')}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moons}>
            {months.map((month) => (
              <Pressable
                key={month.key}
                accessibilityRole="button"
                accessibilityLabel={
                  month.stars === 1
                    ? t('profile.moonLabelOne', { month: month.label, days: month.days })
                    : t('profile.moonLabel', { month: month.label, n: month.stars, days: month.days })
                }
                onPress={() => router.push('/ceu')}
                style={styles.moon}>
                <Moon lit={month.stars / month.days} current={month.current} />
                <AppText variant="caption" style={[styles.badgeText, { color: OBS.soft }]}>
                  {month.label.charAt(0).toLocaleUpperCase() + month.label.slice(1)}
                </AppText>
                <AppText variant="caption" style={styles.moonCount}>
                  {String(month.stars)}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(['grid', 'shine'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[styles.tab, tab === value && { backgroundColor: OBS.lilac }]}>
              <AppText variant="bodyStrong" style={{ color: tab === value ? OBS.ink : OBS.soft, fontSize: 14 }}>
                {value === 'grid' ? t('profile.tabAchievements') : t('profile.tabShines')}
              </AppText>
            </Pressable>
          ))}
        </View>

        {tab === 'grid' ? (
          posts.length > 0 ? (
            <View style={styles.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
              {posts.map((post) => (
                <Pressable
                  key={post.id}
                  accessibilityRole="button"
                  accessibilityLabel={post.taskTitle}
                  onPress={() => router.push('/mural')}
                  style={[styles.tile, { width: tileWidth, height: Math.round((tileWidth * 4) / 3) }]}>
                  <Image source={{ uri: post.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
                {t('profile.noPosts')}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/postar')}
                style={({ pressed }) => [styles.inviteButton, styles.emptyButton, { opacity: pressed ? 0.75 : 1 }]}>
                <Sparkle size={16} />
                <AppText variant="bodyStrong" style={{ color: OBS.text }}>
                  {t('post.title')}
                </AppText>
              </Pressable>
            </View>
          )
        ) : (
          <View style={styles.shines}>
            {(activity ?? []).map((event) => (
              <View key={`${event.kind}-${event.userId}-${event.at}`} style={styles.shine}>
                <View style={[styles.shineAvatar, { backgroundColor: planetColor(event.userId) }]}>
                  <AppText variant="bodyStrong" style={{ color: OBS.ink }}>
                    {initialOf(event)}
                  </AppText>
                </View>
                <AppText variant="caption" style={[styles.flex, { color: OBS.soft }]}>
                  <AppText variant="caption" style={{ color: OBS.text, fontFamily: fonts.extraBold }}>
                    {personName(event)}
                  </AppText>
                  {` ${t(ACTIVITY_TEXT[event.kind])}`}
                </AppText>
                <AppText variant="caption" style={{ color: OBS.faint }}>
                  {timeAgo(t, Date.parse(event.at), now.getTime())}
                </AppText>
              </View>
            ))}
            {activity && activity.length === 0 ? (
              <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
                {t('profile.noShines')}
              </AppText>
            ) : null}
            {activityFailed && !activity ? (
              <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
                {t('social.offline')}
              </AppText>
            ) : null}
          </View>
        )}
      </View>
    </ObservatoryScreen>
  );
}

function HeroButton({ icon, label, onPress }: { icon: 'chevron-left' | 'sliders'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={22} color={OBS.text} strokeWidth={2.2} />
    </Pressable>
  );
}

function StatButton({ value, label, sub, onPress }: { value: number; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}${sub ? ` (${sub})` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && { backgroundColor: OBS.card }]}>
      <AppText variant="timeSmall" style={{ color: OBS.text }}>
        {String(value)}
      </AppText>
      <AppText variant="caption" style={[styles.badgeText, styles.center, { color: OBS.soft }]}>
        {label}
      </AppText>
      {sub ? (
        <AppText variant="caption" style={[styles.statSub, { color: OBS.faint }]}>
          {sub}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** A lua do mês: quanto mais noites acesas, mais cheia (a parte acesa entra pela direita). */
function Moon({ lit, current }: { lit: number; current: boolean }) {
  const shadow = 29 - Math.min(lit, 1) * 52;
  return (
    <Svg width={58} height={58} viewBox="0 0 58 58">
      <Defs>
        <ClipPath id="lua">
          <Circle cx={29} cy={29} r={24} />
        </ClipPath>
      </Defs>
      <Circle cx={29} cy={29} r={28} fill="none" stroke={current ? OBS.gold : '#3A4080'} strokeWidth={1.5} />
      <G clipPath="url(#lua)">
        <Circle cx={29} cy={29} r={24} fill="#FFF4D6" />
        <Circle cx={shadow} cy={29} r={26} fill="#1A1F4D" />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  hero: { position: 'relative' },
  heroSky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 64,
    borderBottomRightRadius: 64,
    backgroundColor: '#161B4A',
    experimental_backgroundImage: 'radial-gradient(circle at 50% 0%, #2A2F7A 0%, #161B4A 50%, #0E1233 100%)',
    overflow: 'hidden',
  },
  heroBar: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 14, 36, 0.4)',
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 14, 36, 0.4)',
  },
  planet: {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    width: 128,
    height: 128,
    marginLeft: -64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planetLetter: { fontFamily: fonts.extraBold, fontSize: 38, lineHeight: 46, color: OBS.ink },
  body: { paddingHorizontal: 20, gap: 14 },
  identity: { alignItems: 'center', gap: 4, paddingTop: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeGold: { backgroundColor: 'rgba(255, 200, 87, 0.12)', borderColor: 'rgba(255, 200, 87, 0.35)' },
  badgeLilac: { backgroundColor: 'rgba(185, 166, 255, 0.12)', borderColor: 'rgba(185, 166, 255, 0.35)' },
  badgeText: { fontFamily: fonts.extraBold },
  stats: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 22,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 18 },
  statSub: { fontSize: 11, lineHeight: 14 },
  statDivider: { width: 1, marginVertical: 10, backgroundColor: OBS.line },
  actions: { flexDirection: 'row', gap: 8 },
  editButton: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OBS.lilac,
    experimental_backgroundImage: 'linear-gradient(180deg, #C8BAFF 0%, #A991FF 100%)',
  },
  inviteButton: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: OBS.cardMineBorder,
  },
  editCard: { gap: 8, padding: 14, borderRadius: 22, backgroundColor: OBS.card, borderWidth: 1, borderColor: OBS.cardBorder },
  fieldLabel: { color: OBS.soft, fontFamily: fonts.extraBold },
  input: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: OBS.line,
    backgroundColor: OBS.background,
    color: OBS.text,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  handleInput: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: OBS.line,
    backgroundColor: OBS.background,
  },
  handleText: { flex: 1, height: 44, color: OBS.text, fontFamily: fonts.semiBold, fontSize: 16 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  saveButton: { height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: OBS.lilac },
  section: { gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 15 },
  moons: { gap: 16 },
  moon: { alignItems: 'center', gap: 4 },
  moonCount: { fontSize: 11, lineHeight: 14, color: OBS.faint },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  tab: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    backgroundColor: OBS.raised,
    borderWidth: 1,
    borderColor: OBS.track,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  emptyButton: { flex: 0, flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  shines: { gap: 8 },
  shine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  shineAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
