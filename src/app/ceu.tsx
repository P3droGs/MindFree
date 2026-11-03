import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BackButton, IconButton, OutlineButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { ConstellationSheet } from '@/components/constellation-sheet';
import { Screen } from '@/components/screen';
import { useNow } from '@/hooks/use-now';
import { useT, type Translate } from '@/i18n';
import { eveningDay } from '@/lib/capture';
import { constellationName, miniPoints, pastConstellations, starPosition, type MonthKey } from '@/lib/constellations';
import { longDate, monthName } from '@/lib/dates';
import { dateFromKey, nightProgress, nightsInMonth, type Night } from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

const SKY = '#070A1C';
const SKY_HEIGHT = 250;

const MINI_WIDTH = 52;
const MINI_HEIGHT = 36;

/** "outubro" no ano de agora; "outubro 2025" nos outros anos. */
/** "3 coisas anotadas" e "1 concluída": o plural certo para cada número. */
function countTexts(t: Translate, noted: number, done: number) {
  return {
    noted: noted === 1 ? t('sky.notedOne') : t('sky.noted', { n: noted }),
    done: done === 1 ? t('sky.doneOne') : t('sky.done', { n: done }),
  };
}

function monthLabel(t: Translate, month: MonthKey, currentYear: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const name = monthName(t, monthNumber - 1);
  return year === currentYear ? name : `${name} ${year}`;
}

export default function SkyScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { settings } = useSettings();
  const { journal } = useJournal();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  // Com a fonte grande do celular, três números lado a lado quebram as palavras no meio: ficam um embaixo do outro.
  const stackStats = fontScale > 1.3;
  const width = Math.min(screenWidth, 520) - 48;
  const now = useNow();
  const tonight = eveningDay(now, settings.morningMinutes);
  const nights = nightsInMonth(journal, dateFromKey(tonight));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = nights.find((night) => night.id === selectedId) ?? nights.at(-1);
  const stars = nights.map((night) => {
    const progress = nightProgress(journal, night);
    const ratio = progress.noted ? progress.done / progress.noted : 0;
    const [x, y] = starPosition(dateFromKey(night.day).getDate(), width);
    return { night, progress, ratio, x, y, isNew: night.day === tonight };
  });
  const totals = stars.reduce(
    (sum, star) => ({ noted: sum.noted + star.progress.noted, done: sum.done + star.progress.done }),
    { noted: 0, done: 0 },
  );
  const month = monthName(t, dateFromKey(tonight).getMonth());
  // A coleção: cada mês que já terminou vira uma constelação com nome (da lista pronta, ou o que a pessoa deu).
  const currentYear = dateFromKey(tonight).getFullYear();
  const collection = pastConstellations(journal, tonight.slice(0, 7));
  const [renaming, setRenaming] = useState<MonthKey | null>(null);

  const share = () => {
    const message =
      nights.length === 1
        ? t('sky.shareOne', { month })
        : t('sky.shareMany', { n: nights.length, month });
    void Share.share({ message });
  };

  return (
    <Screen>
      <View style={styles.top}>
        <BackButton onPress={() => router.back()} style={styles.back} />
        <IconButton icon="share" label={t('sky.share')} onPress={share} />
      </View>

      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('home.sky')}
        </AppText>
        <AppText tone="secondary">{t('sky.intro')}</AppText>
      </View>

      <View style={[styles.sky, { height: SKY_HEIGHT, boxShadow: theme.cardShadow }]}>
        <Svg width={width} height={SKY_HEIGHT} style={StyleSheet.absoluteFill}>
          {[20, 70, 130, 190, 240, 290].map((x, index) => (
            <Circle key={x} cx={(x / 300) * width} cy={18 + ((index * 53) % 210)} r={0.9} fill="#EEF0FF" opacity={0.35} />
          ))}
          {stars.length > 1 ? (
            <Polyline
              points={stars.map((star) => `${star.x},${star.y}`).join(' ')}
              fill="none"
              stroke="#B9A6FF"
              strokeWidth={1.2}
              strokeOpacity={0.35}
              strokeLinejoin="round"
            />
          ) : null}
          {stars.map((star) => {
            const size = star.isNew ? 4.5 : 3 + 4 * star.ratio;
            return (
              <Circle
                key={star.night.id}
                cx={star.x}
                cy={star.y}
                r={size}
                fill={star.ratio === 1 ? '#FFF4D6' : '#EEF0FF'}
                opacity={star.isNew ? 0.95 : 0.55 + 0.45 * star.ratio}
              />
            );
          })}
        </Svg>
        {stars.map((star) => {
          const isSelected = star.night.id === selected?.id;
          return (
            <Pressable
              key={star.night.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t('sky.starLabel', {
                date: longDate(t, star.night.day),
                ...countTexts(t, star.progress.noted, star.progress.done),
              })}
              onPress={() => setSelectedId(star.night.id)}
              style={[
                styles.starHit,
                { left: star.x - 22, top: star.y - 22, borderColor: isSelected ? 'rgba(238,240,255,0.75)' : 'transparent' },
              ]}
            />
          );
        })}
        <View style={styles.skyFooter} pointerEvents="none">
          <AppText variant="heading" style={styles.skyMonth}>
            {month.charAt(0).toLocaleUpperCase() + month.slice(1)}
          </AppText>
          <AppText variant="caption" style={styles.skyCount}>
            {nights.length === 1 ? t('sky.starsOne') : t('sky.starsMany', { n: nights.length })}
          </AppText>
        </View>
        {nights.length === 0 ? (
          <View style={styles.emptySky} pointerEvents="none">
            <AppText variant="small" style={styles.emptyText}>
              {t('sky.empty')}
            </AppText>
          </View>
        ) : null}
      </View>

      {selected ? <NightDetail night={selected} isNew={selected.day === tonight} /> : null}

      <View style={[styles.stats, stackStats && styles.statsStacked]}>
        <Stat value={nights.length} label={nights.length === 1 ? t('sky.statNightsOne') : t('sky.statNights')} stacked={stackStats} />
        <Stat value={totals.noted} label={totals.noted === 1 ? t('sky.statNotedOne') : t('sky.statNoted')} stacked={stackStats} />
        <Stat value={totals.done} label={totals.done === 1 ? t('sky.statDoneOne') : t('sky.statDone')} stacked={stackStats} />
      </View>

      <View style={styles.section}>
        <AppText variant="heading">{t('sky.collection')}</AppText>
        <AppText variant="small" tone="secondary">
          {collection.length ? t('sky.collectionHint') : t('sky.collectionEmpty', { month })}
        </AppText>
        {collection.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collection}>
            {collection.map((item) => {
              const name = constellationName(t, settings.constellationNames, item.month);
              const label = monthLabel(t, item.month, currentYear);
              const points = miniPoints(item.days, MINI_WIDTH, MINI_HEIGHT);
              const stars = item.days.length;
              return (
                <Pressable
                  key={item.month}
                  accessibilityRole="button"
                  accessibilityLabel={t('sky.constellationLabel', { name, month: label })}
                  onPress={() => setRenaming(item.month)}
                  style={({ pressed }) => [styles.constellation, { backgroundColor: SKY, opacity: pressed ? 0.8 : 1 }]}>
                  <Svg width={MINI_WIDTH} height={MINI_HEIGHT} viewBox={`0 0 ${MINI_WIDTH} ${MINI_HEIGHT}`}>
                    {points.length > 1 ? (
                      <Polyline
                        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
                        fill="none"
                        stroke="#B9A6FF"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                      />
                    ) : null}
                    {points.map(([cx, cy], index) => (
                      <Circle key={item.days[index]} cx={cx} cy={cy} r={1.8} fill="#FFF4D6" />
                    ))}
                  </Svg>
                  <AppText variant="bodyStrong" numberOfLines={2} style={styles.constellationName}>
                    {name}
                  </AppText>
                  <AppText variant="caption" style={styles.constellationMeta}>
                    {stars === 1
                      ? t('sky.collectionMetaOne', { month: label })
                      : t('sky.collectionMeta', { month: label, n: stars })}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
      <ConstellationSheet
        month={renaming}
        monthLabel={renaming ? monthLabel(t, renaming, currentYear) : ''}
        onClose={() => setRenaming(null)}
      />

      <OutlineButton label={t('sky.share')} icon="share" onPress={share} />
      <AppText variant="small" tone="secondary" style={styles.center}>
        {t('sky.neverFades')}
      </AppText>
    </Screen>
  );
}

function NightDetail({ night, isNew }: { night: Night; isNew: boolean }) {
  const t = useT();
  const { journal } = useJournal();
  const progress = nightProgress(journal, night);
  const left = progress.noted - progress.done;
  let hint = t('sky.hintLeftMany', { n: left });
  if (isNew) hint = t('sky.hintNew');
  else if (left <= 0) hint = t('sky.hintComplete');
  else if (left === 1) hint = t('sky.hintLeftOne');

  return (
    <Card>
      <View style={styles.detailTitle}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M12 2 C 13 8, 16 11, 22 12 C 16 13, 13 16, 12 22 C 11 16, 8 13, 2 12 C 8 11, 11 8, 12 2 Z" fill="#FFC857" />
        </Svg>
        <AppText variant="heading" style={styles.flex}>
          {longDate(t, night.day) + (isNew ? ` · ${t('date.today').toLocaleLowerCase()}` : '')}
        </AppText>
      </View>
      <AppText variant="small" tone="secondary">
        {t('sky.nightStats', countTexts(t, progress.noted, progress.done))}
      </AppText>
      <AppText variant="small">{hint}</AppText>
    </Card>
  );
}

function Stat({ value, label, stacked }: { value: number; label: string; stacked: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.stat, stacked && styles.statStacked, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppText variant="timeSmall">{String(value)}</AppText>
      <AppText variant="caption" tone="secondary" style={stacked ? styles.flex : styles.center}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { marginLeft: -10 },
  intro: { gap: 8 },
  sky: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1E2350',
    backgroundColor: SKY,
    experimental_backgroundImage: 'radial-gradient(circle at 50% 100%, #1C2258 0%, #0E1233 55%, #070A1C 100%)',
    overflow: 'hidden',
  },
  starHit: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5 },
  skyFooter: { position: 'absolute', left: 16, bottom: 12, right: 16, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  skyMonth: { color: '#EEF0FF' },
  skyCount: { color: '#C9CDEB' },
  emptySky: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#C9CDEB', textAlign: 'center' },
  detailTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stats: { flexDirection: 'row', gap: 10 },
  statsStacked: { flexDirection: 'column' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 18, borderWidth: 1 },
  statStacked: { flexDirection: 'row', gap: 14, paddingHorizontal: 18 },
  section: { gap: 8 },
  collection: { gap: 10, paddingRight: 4 },
  // Cresce com o texto (fonte grande do celular) em vez de quebrar a palavra no meio.
  constellation: { minWidth: 150, maxWidth: 260, gap: 4, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#1E2350' },
  constellationName: { color: '#EEF0FF' },
  constellationMeta: { color: '#C9CDEB' },
  center: { textAlign: 'center' },
});
