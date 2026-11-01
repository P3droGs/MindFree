import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BrightnessSlider } from '@/components/brightness-slider';
import { LinkButton, PrimaryButton } from '@/components/buttons';
import { ColorWheel } from '@/components/color-wheel';
import { useT } from '@/i18n';
import { hsvToHex, type Hsv } from '@/theme/color';
import { useAppTheme } from '@/theme/theme-provider';

type ColorPickerProps = {
  value: Hsv;
  onChange: (color: Hsv) => void;
  /** Guarda a cor e fecha a roda. */
  onConfirm: () => void;
  /** Volta para a cor que estava antes de abrir a roda. */
  onCancel: () => void;
  /** Aviso de leitura, mostrado quando a combinação fica difícil de ler. */
  warning?: string;
  onSlidingChange?: (sliding: boolean) => void;
};

/** Paleta completa: roda de cores + brilho + o código da cor, com Confirmar e Cancelar. */
export function ColorPicker({ value, onChange, onConfirm, onCancel, warning, onSlidingChange }: ColorPickerProps) {
  const theme = useAppTheme();
  const t = useT();
  const hex = hsvToHex(value);

  return (
    <View style={styles.container}>
      <ColorWheel
        hue={value.h}
        saturation={value.s}
        brightness={value.v}
        onChange={({ h, s }) => onChange({ ...value, h, s })}
        onSlidingChange={onSlidingChange}
      />

      <View style={styles.brightness}>
        <BrightnessSlider
          value={value.v}
          color={hsvToHex({ ...value, v: 1 })}
          thumbColor={hex}
          onChange={(v) => onChange({ ...value, v })}
          onSlidingChange={onSlidingChange}
        />
        <View style={styles.brightnessLabels}>
          <AppText variant="caption" tone="secondary">
            {t('color.darker')}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('color.lighter')}
          </AppText>
        </View>
      </View>

      <View style={styles.codeRow}>
        <View style={[styles.preview, { backgroundColor: hex, borderColor: theme.border }]} />
        <AppText variant="bodyStrong" accessibilityLabel={t('color.code', { hex })}>
          {hex}
        </AppText>
      </View>

      {warning ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {warning}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label={t('color.confirm')} icon="check" onPress={onConfirm} />
        <View style={styles.cancel}>
          <LinkButton label={t('common.cancel')} onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 4 },
  brightness: { gap: 6 },
  brightnessLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  actions: { gap: 2 },
  cancel: { alignItems: 'center' },
});
