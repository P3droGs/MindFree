import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useI18n } from '@/i18n';
import { listenNotificationOpens } from '@/lib/notifications';
import { registerThisDevice, savePushPrefs } from '@/lib/push';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';

/**
 * Os avisos dos amigos (push): com o @ pronto, cadastra este celular e manda para o servidor
 * quais avisos a pessoa quer e o horário de sono dela. Também abre a tela certa ao tocar num aviso.
 */
export function usePushSync() {
  const router = useRouter();
  const { status } = useSocial();
  const { settings } = useSettings();
  const { language, t } = useI18n();
  const ready = status === 'ready';

  useEffect(() => listenNotificationOpens((path) => router.push(path as Href)), [router]);

  // Cadastra ao entrar na rede e de novo ao voltar para o app (a permissão pode ter sido ligada lá fora).
  useEffect(() => {
    if (!ready) return;
    void registerThisDevice(t).catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerThisDevice(t).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [ready, t]);

  const { pushShine, pushPoke, pushMural, pushRequests, nightMinutes, morningMinutes } = settings;
  const code = language.code;
  useEffect(() => {
    if (!ready) return;
    // Espera um pouco: os horários mudam de 15 em 15 minutos a cada toque.
    const timeout = setTimeout(() => {
      void savePushPrefs({
        shine: pushShine,
        poke: pushPoke,
        mural: pushMural,
        requests: pushRequests,
        nightMinutes,
        morningMinutes,
        language: code,
      }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [ready, pushShine, pushPoke, pushMural, pushRequests, nightMinutes, morningMinutes, code]);
}
