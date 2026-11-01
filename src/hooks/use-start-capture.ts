import { useRouter } from 'expo-router';

import { shouldAskConsent } from '@/lib/consent';
import { useSettings } from '@/state/settings';

/** Abrir a gravação ou o "Escrever", passando antes pelo consentimento da IA quando ainda não foi respondido. */
export function useStartCapture() {
  const router = useRouter();
  const { settings } = useSettings();

  const start = (next: 'gravar' | 'escrever') => {
    if (shouldAskConsent(settings)) {
      router.push({ pathname: '/consentimento', params: { next } });
    } else {
      router.push(next === 'gravar' ? '/gravar' : '/escrever');
    }
  };

  return { record: () => start('gravar'), write: () => start('escrever') };
}
