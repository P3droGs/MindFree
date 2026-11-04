import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { I18nProvider } from '@/i18n';
import { useExactAlarmRefresh } from '@/hooks/use-exact-alarm-refresh';
import { useModerationNotices } from '@/hooks/use-moderation-notices';
import { usePushSync } from '@/hooks/use-push-sync';
import { configureNotifications } from '@/lib/notifications';
import { AccountProvider } from '@/state/account';
import { JournalProvider } from '@/state/journal-provider';
import { SettingsProvider, useSettings } from '@/state/settings';
import { SocialProvider } from '@/state/social';
import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';
import { useWidgetSync } from '@/widgets/use-widget-sync';

SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_600SemiBold, Nunito_800ExtraBold });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SettingsProvider>
      <I18nProvider>
        <JournalProvider>
          <AccountProvider>
            <SocialProvider>
              <AppThemeProvider>
                <AppNavigator />
              </AppThemeProvider>
            </SocialProvider>
          </AccountProvider>
        </JournalProvider>
      </I18nProvider>
    </SettingsProvider>
  );
}

function AppNavigator() {
  const { settings } = useSettings();
  const theme = useAppTheme();
  useWidgetSync();
  usePushSync();
  useExactAlarmRefresh();
  useModerationNotices();
  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.accentStrong,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: theme.background },
        }}>
        {/* Primeiro uso: só existe enquanto a pessoa não terminou a configuração.
            O redirectTo é explícito: sem ele, o expo-router escolhe a "primeira tela livre" pela lista
            de arquivos (e abria o app em "entrar", com o voltar preso num ciclo). */}
        <Stack.Protected guard={!settings.onboarded} redirectTo="/">
          <Stack.Screen name="boas-vindas" />
          <Stack.Screen name="horarios" />
          <Stack.Screen name="alarmes" />
        </Stack.Protected>
        <Stack.Protected guard={settings.onboarded} redirectTo="/boas-vindas">
          <Stack.Screen name="index" />
          <Stack.Screen name="ajustes" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="gravar" options={{ gestureEnabled: false }} />
          <Stack.Screen name="anotado" options={{ gestureEnabled: false }} />
          <Stack.Screen name="escrever" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ceu" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="calendario" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tarefa/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="amigos" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="mural" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="postar" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="perfil" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="orbita" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="convidar" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="bloqueados" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="consentimento" options={{ animation: 'slide_from_bottom' }} />
        </Stack.Protected>
        {/* Abrem de qualquer lugar: a política e entrar ou criar conta (no começo ou depois, em Ajustes).
            Ficam por último porque a primeira tela disponível da lista é a que abre o app. */}
        <Stack.Screen name="privacidade" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="entrar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="criar-conta" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="codigo" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}
