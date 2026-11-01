import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ColorPicker } from '@/components/color-picker';
import { Segmented } from '@/components/segmented';
import { Swatch } from '@/components/swatch';
import { useT, type MessageKey } from '@/i18n';
import { useSettings, type BackgroundMode, type Settings } from '@/state/settings';
import { hsvToHex } from '@/theme/color';
import {
  BACKGROUND_PRESETS,
  DAY_BACKGROUND,
  NIGHT_BACKGROUND,
  ONBOARDING_BACKGROUNDS,
  RAINBOW,
} from '@/theme/palette';
import { useAppTheme } from '@/theme/theme-provider';

const MODE_LABELS: Record<BackgroundMode, MessageKey> = {
  auto: 'bg.modeAuto',
  escuro: 'bg.modeDark',
  claro: 'bg.modeLight',
  cor: 'bg.modeColor',
};

const MODE_HINTS: Record<BackgroundMode, MessageKey> = {
  auto: 'bg.hintAuto',
  escuro: 'bg.hintDark',
  claro: 'bg.hintLight',
  cor: 'bg.hintColor',
};

type BackgroundSnapshot = Pick<Settings, 'backgroundMode' | 'backgroundSource' | 'backgroundCustom'>;

type BackgroundPickerProps = {
  /** Versão do primeiro uso: menos fundos prontos e sem os modos. */
  compact?: boolean;
  onSlidingChange?: (sliding: boolean) => void;
};

export function BackgroundPicker({ compact, onSlidingChange }: BackgroundPickerProps) {
  const theme = useAppTheme();
  const t = useT();
  const { settings, update } = useSettings();
  const { backgroundMode, backgroundSource, backgroundColor, backgroundCustom } = settings;
  // O fundo de antes de abrir a roda, para o "Cancelar" poder voltar.
  const [before, setBefore] = useState<BackgroundSnapshot | null>(null);
  const editing = before !== null;
  const isCustom = backgroundMode === 'cor' && backgroundSource === 'custom';
  const isPresetSelected = (hex: string) =>
    backgroundMode === 'cor' && backgroundSource === 'preset' && backgroundColor === hex;

  const pickPreset = (hex: string) => {
    setBefore(null);
    update({ backgroundMode: 'cor', backgroundSource: 'preset', backgroundColor: hex });
  };
  const openWheel = () => {
    if (!editing) setBefore({ backgroundMode, backgroundSource, backgroundCustom });
    update({ backgroundMode: 'cor', backgroundSource: 'custom' });
  };
  const cancel = () => {
    if (before) update(before);
    setBefore(null);
  };

  const presets = compact ? ONBOARDING_BACKGROUNDS : BACKGROUND_PRESETS;
  const swatches = (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {compact ? (
        <Swatch
          label={t('bg.autoSwatch')}
          colors={[NIGHT_BACKGROUND, DAY_BACKGROUND]}
          selected={backgroundMode === 'auto'}
          onPress={() => {
            setBefore(null);
            update({ backgroundMode: 'auto' });
          }}
        />
      ) : null}
      {presets.map((preset) => (
        <Swatch
          key={preset.hex}
          label={t('bg.swatch', { name: t(`bg.${preset.id}`) })}
          colors={[preset.hex]}
          selected={isPresetSelected(preset.hex)}
          onPress={() => pickPreset(preset.hex)}
        />
      ))}
      <Swatch
        label={t('bg.any')}
        colors={isCustom ? [hsvToHex(backgroundCustom)] : RAINBOW}
        selected={isCustom}
        onPress={openWheel}
      />
    </View>
  );
  const picker = editing ? (
    <ColorPicker
      value={backgroundCustom}
      onChange={(color) => update({ backgroundCustom: color })}
      onConfirm={() => setBefore(null)}
      onCancel={cancel}
      warning={theme.lowTextContrast ? t('bg.reading') : undefined}
      onSlidingChange={onSlidingChange}
    />
  ) : null;

  if (compact) {
    const selected = presets.find((preset) => isPresetSelected(preset.hex));
    let hint = t('bg.compactSelected', { name: selected ? t(`bg.${selected.id}`) : t('bg.chosen') });
    if (backgroundMode === 'auto') hint = t('bg.compactAuto');
    if (isCustom) hint = t('bg.custom', { hex: hsvToHex(backgroundCustom) });
    if (editing) hint = t('bg.editing');

    return (
      <View style={styles.container}>
        {swatches}
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
        {picker}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Segmented
        options={(Object.keys(MODE_LABELS) as BackgroundMode[]).map((value) => ({ value, label: t(MODE_LABELS[value]) }))}
        value={backgroundMode}
        onChange={(mode) => {
          setBefore(null);
          update({ backgroundMode: mode });
        }}
      />
      <AppText variant="caption" tone="secondary">
        {editing ? t('bg.editing') : t(MODE_HINTS[backgroundMode])}
      </AppText>
      {backgroundMode === 'cor' ? (
        <View style={styles.colorArea}>
          <AppText variant="bodyStrong">{t('bg.readyOrAny')}</AppText>
          {swatches}
          {picker}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: -5 },
  colorArea: { gap: 10, paddingTop: 4 },
});
