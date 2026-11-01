import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ColorPicker } from '@/components/color-picker';
import { Swatch } from '@/components/swatch';
import { useT } from '@/i18n';
import { useSettings, type Settings } from '@/state/settings';
import { hsvToHex } from '@/theme/color';
import { ACCENTS, RAINBOW, type AccentId } from '@/theme/palette';
import { useAppTheme } from '@/theme/theme-provider';

type AccentPickerProps = {
  onSlidingChange?: (sliding: boolean) => void;
};

/** Cor do app: as prontas ou qualquer cor da roda (que só fica depois de "Confirmar cor"). */
export function AccentPicker({ onSlidingChange }: AccentPickerProps) {
  const theme = useAppTheme();
  const t = useT();
  const { settings, update } = useSettings();
  const { accentId, accentCustom } = settings;
  // O que estava escolhido antes de abrir a roda, para o "Cancelar" poder voltar.
  const [before, setBefore] = useState<Pick<Settings, 'accentId' | 'accentCustom'> | null>(null);
  const editing = before !== null;
  const isCustom = accentId === 'custom';
  const customHex = hsvToHex(accentCustom);

  const openWheel = () => {
    if (!editing) setBefore({ accentId, accentCustom });
    update({ accentId: 'custom' });
  };
  const pickPreset = (id: AccentId) => {
    setBefore(null);
    update({ accentId: id });
  };
  const cancel = () => {
    if (before) update(before);
    setBefore(null);
  };

  const presetId = isCustom ? 'classico' : accentId;
  let hint =
    presetId === 'classico'
      ? t('accent.hintClassico')
      : t('accent.hintAllDay', { name: t(`accent.${presetId}`) });
  if (isCustom) hint = t('accent.custom', { hex: customHex });
  if (editing) hint = t('accent.editing');

  return (
    <View style={styles.container}>
      <View accessibilityRole="radiogroup" style={styles.row}>
        {ACCENTS.map((accent) => (
          <Swatch
            key={accent.id}
            label={t('accent.swatch', { name: t(`accent.${accent.id}`) })}
            colors={accent.dayFill ? [accent.fill, accent.dayFill] : [accent.fill]}
            selected={accent.id === accentId}
            onPress={() => pickPreset(accent.id)}
          />
        ))}
        <Swatch
          label={t('accent.any')}
          colors={isCustom ? [customHex] : RAINBOW}
          selected={isCustom}
          onPress={openWheel}
        />
      </View>
      <AppText variant="caption" tone="secondary">
        {hint}
      </AppText>

      {editing ? (
        <ColorPicker
          value={accentCustom}
          onChange={(color) => update({ accentCustom: color })}
          onConfirm={() => setBefore(null)}
          onCancel={cancel}
          warning={
            theme.accentBlendsIn
              ? t('accent.blends')
              : undefined
          }
          onSlidingChange={onSlidingChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: -5 },
});
