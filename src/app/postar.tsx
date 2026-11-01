import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/buttons';
import { Icon, type IconName } from '@/components/icon';
import { OBS, ObservatoryScreen, Sparkle } from '@/components/observatory';
import { SocialGate } from '@/components/social-gate';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { formatMinutes } from '@/lib/time';
import { addDays, dayKey, newId } from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { changePosts, keepPhoto } from '@/state/posts';
import { fonts } from '@/theme/typography';

export default function PostRoute() {
  return (
    <SocialGate>
      <PostScreen />
    </SocialGate>
  );
}

/** Postar uma conquista: uma tarefa concluída e uma foto de verdade, da câmera ou da galeria. */
function PostScreen() {
  const router = useRouter();
  const t = useT();
  const { journal } = useJournal();
  const today = dayKey(useNow());
  const recentDone = journal.tasks
    .filter((task) => task.done && task.day >= addDays(today, -7))
    .sort((a, b) => b.changedAt - a.changedAt)
    .slice(0, 6);
  const [picked, setPicked] = useState(recentDone[0]?.id ?? '');
  const [ownTitle, setOwnTitle] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const pickedTask = recentDone.find((task) => task.id === picked);
  const title = pickedTask?.title ?? ownTitle.trim();
  const canPost = !!photo && !!title && !posting;

  const choose = async (source: 'camera' | 'library') => {
    // Só a câmera pede permissão. A galeria abre o seletor do sistema, que só entrega a foto escolhida.
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('post.deniedTitle'), t('post.deniedCamera'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  const post = async () => {
    if (!photo || !title) return;
    setPosting(true);
    const id = newId('post');
    const photoUri = await keepPhoto(photo, id);
    changePosts((current) => [
      { id, taskTitle: title, caption: caption.trim(), photoUri, createdAt: Date.now() },
      ...current,
    ]);
    // Veio do mural: volta para ele (em vez de abrir outro por cima). De outro lugar: o mural toma o lugar desta tela.
    router.dismissTo('/mural');
  };

  return (
    <ObservatoryScreen dock={false}>
      <BackButton onPress={() => router.back()} color={OBS.text} style={styles.back} />
      <AppText variant="title" accessibilityRole="header" style={{ color: OBS.text }}>
        {t('post.title')}
      </AppText>

      <View style={styles.section}>
        <AppText variant="heading" style={{ color: OBS.text }}>
          {t('post.whichTask')}
        </AppText>
        {recentDone.length > 0 ? (
          recentDone.map((task) => {
            const selected = task.id === picked;
            return (
              <Pressable
                key={task.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPicked(task.id)}
                style={[
                  styles.task,
                  selected
                    ? { backgroundColor: OBS.cardMine, borderColor: OBS.gold }
                    : { backgroundColor: OBS.card, borderColor: OBS.cardBorder },
                ]}>
                <View style={[styles.radio, { borderColor: selected ? OBS.gold : OBS.ringOff }]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <AppText variant="bodyStrong" style={[styles.flex, { color: OBS.text }]}>
                  {task.title}
                </AppText>
                {task.minutes !== null ? (
                  <AppText variant="caption" style={{ color: OBS.faint }}>
                    {formatMinutes(task.minutes)}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <>
            <AppText variant="caption" style={{ color: OBS.muted }}>
              {t('post.noDone')}
            </AppText>
            <TextInput
              value={ownTitle}
              onChangeText={setOwnTitle}
              placeholder={t('post.ownPlaceholder')}
              placeholderTextColor={OBS.faint}
              accessibilityLabel={t('post.whichTask')}
              style={styles.input}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="heading" style={{ color: OBS.text }}>
          {t('post.photo')}
        </AppText>
        {photo ? (
          <View style={styles.preview}>
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          </View>
        ) : null}
        <View style={styles.sources}>
          <SourceButton
            icon="camera"
            label={photo ? t('post.changePhoto') : t('post.camera')}
            onPress={() => void choose('camera')}
          />
          <SourceButton icon="image" label={t('post.library')} onPress={() => void choose('library')} />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" style={{ color: OBS.text }}>
          {t('post.caption')}
          <AppText variant="caption" style={{ color: OBS.faint }}>
            {` ${t('post.optional')}`}
          </AppText>
        </AppText>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          maxLength={140}
          multiline
          placeholder={t('post.captionPlaceholder')}
          placeholderTextColor={OBS.faint}
          accessibilityLabel={t('post.caption')}
          style={[styles.input, styles.captionInput]}
        />
      </View>

      <View style={styles.audience}>
        <Icon name="users" size={18} color={OBS.soft} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" style={{ color: OBS.text }}>
            {t('post.audience')}
          </AppText>
          <AppText variant="caption" style={{ color: OBS.muted }}>
            {t('post.audienceHint')}
          </AppText>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPost }}
        disabled={!canPost}
        onPress={() => void post()}
        style={({ pressed }) => [
          styles.postButton,
          { opacity: canPost ? (pressed ? 0.85 : 1) : 0.5, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}>
        <Sparkle size={20} color={OBS.ink} />
        <AppText variant="button" style={{ color: OBS.ink }}>
          {t('post.submit')}
        </AppText>
      </Pressable>
      {!photo ? (
        <AppText variant="caption" style={[styles.center, { color: OBS.faint }]}>
          {t('post.needPhoto')}
        </AppText>
      ) : null}
    </ObservatoryScreen>
  );
}

function SourceButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.source, { opacity: pressed ? 0.75 : 1 }]}>
      <Icon name={icon} size={22} color={OBS.goldText} />
      <AppText variant="bodyStrong" style={{ color: OBS.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginLeft: -10 },
  section: { gap: 10 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: OBS.gold },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: OBS.line,
    backgroundColor: OBS.card,
    color: OBS.text,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  captionInput: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  preview: {
    height: 300,
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: OBS.raised,
  },
  sources: { flexDirection: 'row', gap: 10 },
  source: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: OBS.ringOff,
    backgroundColor: '#141A42',
  },
  audience: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, backgroundColor: OBS.card },
  postButton: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: OBS.gold,
    experimental_backgroundImage: 'linear-gradient(160deg, #FFE7A8 0%, #FFC857 55%, #B9A6FF 100%)',
  },
  center: { textAlign: 'center' },
});
