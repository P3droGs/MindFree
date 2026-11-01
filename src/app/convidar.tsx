import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { OBS, ObsChip, ObservatoryScreen } from '@/components/observatory';
import { SocialGate } from '@/components/social-gate';
import { useT, type MessageKey } from '@/i18n';
import { displayName, social, SocialError, type SocialFailure } from '@/lib/social';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { fonts } from '@/theme/typography';

/** Com 3 convites, a constelação ganha o brilho especial. */
const GOAL = 3;

const REDEEM_ERROR: Partial<Record<SocialFailure, MessageKey>> = {
  code_not_found: 'invite.codeNotFound',
  own_code: 'invite.ownCode',
  too_many: 'invite.tooMany',
  network: 'social.offline',
};

export default function InviteRoute() {
  return (
    <SocialGate>
      <InviteScreen />
    </SocialGate>
  );
}

/** Chamar alguém para o seu céu (os dois ganham uma estrela cadente) ou usar o código de um amigo. */
function InviteScreen() {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings();
  const { profile, refresh } = useSocial();
  const [shared, setShared] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<MessageKey | null>(null);
  const myCode = profile?.code ?? '';
  const message = t('invite.message', { code: myCode });
  const initial = (settings.name.trim()[0] ?? profile?.handle[0] ?? 'M').toLocaleUpperCase();
  const invites = profile?.invites ?? 0;
  let earnedHint = t('invite.earnedNone');
  if (invites === 1) earnedHint = t('invite.earnedOne');
  if (invites > 1) earnedHint = t('invite.earnedMany', { n: invites });

  const share = async () => {
    const result = await Share.share({ message });
    if (result.action === Share.sharedAction) setShared(true);
  };

  const whatsapp = async () => {
    // Sem o WhatsApp instalado, abre o compartilhar do sistema.
    try {
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
      setShared(true);
    } catch {
      await share();
    }
  };

  const sms = async () => {
    await Linking.openURL(`sms:?body=${encodeURIComponent(message)}`).catch(() => share());
    setShared(true);
  };

  const redeem = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setRedeemError('invite.codeNotFound');
      return;
    }
    setRedeeming(true);
    setRedeemError(null);
    try {
      const friend = await social.redeemInvite(clean);
      setRedeemed(displayName(friend));
      setCode('');
      void refresh();
    } catch (failure) {
      setRedeemError(REDEEM_ERROR[failure instanceof SocialError ? failure.failure : 'unknown'] ?? 'auth.genericError');
    }
    setRedeeming(false);
  };

  return (
    <ObservatoryScreen dock={false}>
      <BackButton onPress={() => router.back()} color={OBS.text} style={styles.back} />

      <View style={styles.hero}>
        <Svg width={220} height={110} viewBox="0 0 220 110">
          <Ellipse cx={110} cy={70} rx={100} ry={26} fill="none" stroke="#2A3275" strokeDasharray="2 6" />
          <Circle cx={60} cy={66} r={26} fill="#C7B8FF" />
          <Circle cx={160} cy={66} r={26} fill={OBS.raised} stroke={OBS.ringOff} strokeDasharray="4 4" />
          <Path d="M96 24 L140 10" stroke="#FFF4D6" strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={140} cy={10} r={3.2} fill="#FFF4D6" />
        </Svg>
        <View style={[styles.heroLetter, { left: 34 }]}>
          <AppText variant="heading" style={{ color: OBS.ink }}>
            {initial}
          </AppText>
        </View>
        <View style={[styles.heroLetter, { left: 134 }]}>
          <AppText variant="heading" style={{ color: OBS.muted }}>
            ?
          </AppText>
        </View>
      </View>

      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header" style={{ color: OBS.text }}>
          {t('invite.title')}
        </AppText>
        <AppText variant="small" style={{ color: OBS.soft }}>
          {t('invite.sub')}
        </AppText>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText variant="bodyStrong" style={{ color: OBS.text }}>
            {t('invite.earned')}
          </AppText>
          <AppText variant="bodyStrong" style={{ color: OBS.goldText }}>
            {t('invite.earnedCount', { n: Math.min(invites, GOAL), total: GOAL })}
          </AppText>
        </View>
        <View style={styles.meter}>
          {Array.from({ length: GOAL }, (_, index) => (
            <View key={index} style={[styles.meterPart, { backgroundColor: index < invites ? OBS.gold : OBS.track }]} />
          ))}
        </View>
        <AppText variant="caption" style={{ color: OBS.muted }}>
          {earnedHint}
        </AppText>
      </View>

      <View style={styles.card}>
        <AppText variant="label" style={{ color: OBS.faint }}>
          {t('invite.yourCode')}
        </AppText>
        <View style={styles.codeRow}>
          <AppText variant="time" selectable style={[styles.flex, styles.code]}>
            {myCode}
          </AppText>
          <ObsChip label={t('invite.share')} filled onPress={() => void share()} />
        </View>
        <View style={styles.apps}>
          <AppButton label="WhatsApp" icon="share" onPress={() => void whatsapp()} />
          <AppButton label={t('invite.messages')} icon="mail" onPress={() => void sms()} />
          <AppButton label={t('invite.more')} icon="plus" onPress={() => void share()} />
        </View>
        {shared ? (
          <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: OBS.goldText }}>
            {t('invite.sharedHint')}
          </AppText>
        ) : null}
        <AppText variant="caption" style={{ color: OBS.muted }}>
          {`${t('invite.readyMessage')} “${message}”`}
        </AppText>
      </View>

      <View style={styles.redeem}>
        <AppText variant="bodyStrong" style={{ color: OBS.text }}>
          {t('invite.haveCode')}
        </AppText>
        <View style={styles.codeRow}>
          <TextInput
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
              setRedeemError(null);
              setRedeemed(null);
            }}
            placeholder={t('invite.codePlaceholder')}
            placeholderTextColor={OBS.faint}
            accessibilityLabel={t('invite.haveCode')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => void redeem()}
            style={[styles.codeInput, code ? styles.codeTyped : null]}
          />
          <ObsChip
            label={redeeming ? t('auth.working') : t('invite.redeem')}
            filled
            onPress={() => {
              if (!redeeming) void redeem();
            }}
          />
        </View>
        {redeemError ? (
          <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: OBS.danger }}>
            {t(redeemError)}
          </AppText>
        ) : null}
        {redeemed ? (
          <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: OBS.goldText }}>
            {t('invite.redeemed', { name: redeemed })}
          </AppText>
        ) : null}
      </View>

      <View style={styles.privacy}>
        <Icon name="lock" size={16} color={OBS.faint} />
        <AppText variant="caption" style={[styles.flex, { color: OBS.faint }]}>
          {t('invite.privacy')}
        </AppText>
      </View>
    </ObservatoryScreen>
  );
}

function AppButton({ label, icon, onPress }: { label: string; icon: 'share' | 'mail' | 'plus'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.appButton, { opacity: pressed ? 0.75 : 1 }]}>
      <Icon name={icon} size={20} color={OBS.text} />
      <AppText variant="caption" style={{ color: OBS.soft }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginLeft: -10 },
  hero: { alignSelf: 'center', width: 220, height: 110 },
  heroLetter: { position: 'absolute', top: 40, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: 8 },
  card: { gap: 10, padding: 16, borderRadius: 22, backgroundColor: OBS.card, borderWidth: 1, borderColor: OBS.cardBorder },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meter: { flexDirection: 'row', gap: 6 },
  meterPart: { flex: 1, height: 8, borderRadius: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { color: OBS.goldText, letterSpacing: 6 },
  apps: { flexDirection: 'row', gap: 8 },
  appButton: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 18,
    backgroundColor: OBS.raised,
  },
  redeem: {
    gap: 10,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: OBS.ringOff,
  },
  codeInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: OBS.card,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
    color: OBS.text,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  // Digitado, o código fica espaçado como no cartão; vazio, o exemplo cabe inteiro.
  codeTyped: { fontFamily: fonts.extraBold, fontSize: 18, letterSpacing: 4 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
