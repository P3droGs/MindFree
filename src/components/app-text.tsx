import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

type Tone = 'primary' | 'secondary' | 'accent' | 'onAccent' | 'danger';

export type AppTextProps = TextProps & {
  variant?: keyof typeof variants;
  tone?: Tone;
};

export function AppText({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const theme = useAppTheme();
  const colors: Record<Tone, string> = {
    primary: theme.text,
    secondary: theme.textSecondary,
    accent: theme.accentStrong,
    onAccent: theme.onAccent,
    danger: theme.danger,
  };

  return <Text style={[variants[variant], { color: colors[tone] }, style]} {...rest} />;
}

const variants = StyleSheet.create({
  display: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 25 },
  bodyStrong: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20 },
  label: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  button: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24 },
  time: { fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] },
  timeSmall: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
