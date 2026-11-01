import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { OBS, Sparkle } from '@/components/observatory';
import { useT } from '@/i18n';

type PostCardProps = {
  name: string;
  initial: string;
  color: string;
  when: string;
  task: string;
  caption?: string;
  photoUri: string;
  /** Guarda a foto baixada pelo id do post (o link da nuvem muda a cada vez que o mural abre). */
  cacheKey?: string;
  /** Uma linha pequena embaixo do horário (ex.: "Só você vê"). */
  note?: string;
  shines: number;
  shinedBy: string;
  reacted: boolean;
  /** Sem isto (o seu próprio post), os brilhos só aparecem, sem botão. */
  onReact?: () => void;
  onDelete?: () => void;
  /** O "⋯" com bloquear e denunciar, nos posts dos outros. */
  onMore?: () => void;
};

/** Um post do mural: a tarefa concluída, a foto em arco e os brilhos. */
export function PostCard(props: PostCardProps) {
  const t = useT();
  const { name, reacted } = props;
  const total = props.shines + (reacted ? 1 : 0);
  const shineColor = reacted ? OBS.ink : OBS.goldText;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: props.color }]}>
          <AppText variant="bodyStrong" style={{ color: OBS.ink }}>
            {props.initial}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" style={{ color: OBS.text }}>
            {name}
          </AppText>
          <AppText variant="caption" style={{ color: OBS.faint }}>
            {props.when}
          </AppText>
          {props.note ? (
            <AppText variant="caption" style={{ color: OBS.muted }}>
              {props.note}
            </AppText>
          ) : null}
        </View>
        {props.onDelete ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={props.onDelete}>
            <AppText variant="caption" style={{ color: OBS.faint }}>
              {t('mural.delete')}
            </AppText>
          </Pressable>
        ) : null}
        {props.onMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('safety.moreLabel', { name })}
            hitSlop={8}
            onPress={props.onMore}
            style={({ pressed }) => [styles.more, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="more" size={20} color={OBS.soft} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.photo}>
        <Image source={{ uri: props.photoUri, cacheKey: props.cacheKey }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={styles.taskBadge}>
          <View style={styles.check}>
            <Icon name="check" size={12} color={OBS.ink} strokeWidth={3.2} />
          </View>
          <AppText variant="caption" numberOfLines={2} style={[styles.flex, styles.taskText]}>
            {props.task}
          </AppText>
        </View>
      </View>

      {props.caption ? (
        <AppText variant="small" style={{ color: OBS.soft }}>
          {props.caption}
        </AppText>
      ) : null}

      <View style={styles.footer}>
        {props.onReact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: reacted }}
            accessibilityLabel={reacted ? t('mural.unshineLabel', { name }) : t('mural.shineLabel', { name })}
            onPress={props.onReact}
            hitSlop={6}
            style={({ pressed }) => [
              styles.shine,
              { backgroundColor: reacted ? OBS.gold : 'transparent', opacity: pressed ? 0.75 : 1 },
            ]}>
            <Sparkle size={15} color={shineColor} />
            <AppText variant="caption" style={[styles.shineText, { color: shineColor }]}>
              {String(total)}
            </AppText>
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityLabel={total === 1 ? t('mural.shinesCountOne') : t('mural.shinesCount', { count: total })}
            style={styles.shine}>
            <Sparkle size={15} color={shineColor} />
            <AppText variant="caption" style={[styles.shineText, { color: shineColor }]}>
              {String(total)}
            </AppText>
          </View>
        )}
        {props.shinedBy || reacted ? (
          <AppText variant="caption" numberOfLines={1} style={[styles.flex, { color: OBS.faint }]}>
            {reacted
              ? props.shinedBy
                ? `${t('friends.you')}, ${props.shinedBy}`
                : t('friends.you')
              : props.shinedBy}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 12, padding: 14, borderRadius: 24, backgroundColor: OBS.card, borderWidth: 1, borderColor: OBS.cardBorder },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  more: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  photo: {
    height: 240,
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    backgroundColor: OBS.raised,
    justifyContent: 'flex-end',
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 14, 36, 0.8)',
  },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: OBS.gold, alignItems: 'center', justifyContent: 'center' },
  taskText: { color: OBS.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shine: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#353C78',
  },
  shineText: { fontVariant: ['tabular-nums'] },
});
