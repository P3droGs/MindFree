import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { OBS, ObsChip } from '@/components/observatory';
import { useT, type MessageKey } from '@/i18n';
import { displayName, REPORT_REASONS, social, type Person, type ReportReason } from '@/lib/social';
import { fonts } from '@/theme/typography';

export type PersonAction = 'removed' | 'blocked' | 'reported' | 'failed';

const REASON_TEXT: Record<ReportReason, MessageKey> = {
  spam: 'safety.reasonSpam',
  offensive: 'safety.reasonOffensive',
  harassment: 'safety.reasonHarassment',
  other: 'safety.reasonOther',
};

/**
 * O menu "⋯" de uma pessoa na rede: remover seguidor (se ela segue você), bloquear e denunciar.
 * Bloquear pergunta antes; denunciar pede o motivo e, se quiser, um texto.
 */
export function PersonActionsSheet({
  person,
  canRemove,
  onClose,
  onDone,
}: {
  person: Person | null;
  canRemove: boolean;
  onClose: () => void;
  onDone: (action: PersonAction) => void;
}) {
  return (
    <Modal visible={!!person} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {person ? <SheetBody key={person.userId} person={person} canRemove={canRemove} onClose={onClose} onDone={onDone} /> : null}
    </Modal>
  );
}

function SheetBody({
  person,
  canRemove,
  onClose,
  onDone,
}: {
  person: Person;
  canRemove: boolean;
  onClose: () => void;
  onDone: (action: PersonAction) => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const name = displayName(person);
  const [step, setStep] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: PersonAction, task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      onDone(action);
    } catch {
      onDone('failed');
    }
    setBusy(false);
  };

  const block = () =>
    Alert.alert(t('safety.blockTitle', { name }), t('safety.blockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('safety.block'), style: 'destructive', onPress: () => void run('blocked', () => social.block(person.userId)) },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={styles.backdrop} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="heading" accessibilityRole="header" style={{ color: OBS.text }}>
              {step === 'menu' ? name : t('safety.reportTitle', { name })}
            </AppText>
            <AppText variant="caption" style={{ color: OBS.muted }}>
              {step === 'menu' ? `@${person.handle}` : t('safety.reportHint')}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={styles.close}>
            <Icon name="x" size={20} color={OBS.text} strokeWidth={2.4} />
          </Pressable>
        </View>

        {step === 'menu' ? (
          <View style={styles.list}>
            {canRemove ? (
              <Option
                label={t('safety.removeFollower')}
                hint={t('safety.removeFollowerHint')}
                onPress={() => void run('removed', () => social.removeFollower(person.userId))}
              />
            ) : null}
            <Option label={t('safety.block')} hint={t('safety.blockHint')} danger onPress={block} />
            <Option label={t('safety.report')} hint={t('safety.reportMenuHint')} danger onPress={() => setStep('report')} />
          </View>
        ) : (
          <View style={styles.list}>
            {REPORT_REASONS.map((value) => {
              const selected = reason === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setReason(value)}
                  style={[styles.reason, selected && styles.reasonSelected]}>
                  <AppText variant="bodyStrong" style={[styles.flex, { color: OBS.text }]}>
                    {t(REASON_TEXT[value])}
                  </AppText>
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <Icon name="check" size={13} color={OBS.ink} strokeWidth={3.6} /> : null}
                  </View>
                </Pressable>
              );
            })}
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('safety.detailsPlaceholder')}
              placeholderTextColor={OBS.faint}
              accessibilityLabel={t('safety.detailsPlaceholder')}
              maxLength={500}
              multiline
              style={styles.details}
            />
            <ObsChip
              label={busy ? t('auth.working') : t('safety.send')}
              filled
              onPress={() => {
                if (reason && !busy) void run('reported', () => social.report(person.userId, reason, details));
              }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Option({ label, hint, danger, onPress }: { label: string; hint: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { opacity: pressed ? 0.75 : 1 }]}>
      <AppText variant="bodyStrong" style={{ color: danger ? OBS.danger : OBS.text }}>
        {label}
      </AppText>
      <AppText variant="caption" style={{ color: OBS.muted }}>
        {hint}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 7, 20, 0.62)' },
  sheet: {
    gap: 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: OBS.cardBorder,
    backgroundColor: OBS.card,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: OBS.cardBorder },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 6 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: OBS.raised },
  list: { gap: 8 },
  option: { gap: 2, minHeight: 56, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: OBS.raised },
  reason: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
  },
  reasonSelected: { borderColor: OBS.lilac, backgroundColor: OBS.raised },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: OBS.ringOff, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderWidth: 0, backgroundColor: OBS.lilac },
  details: {
    minHeight: 72,
    maxHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
    backgroundColor: OBS.background,
    color: OBS.text,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
