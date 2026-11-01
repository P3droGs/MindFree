import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useSettings, type TestClock } from '@/state/settings';

/**
 * Relógio de teste (só existe no modo de desenvolvimento): "noite" finge que são 23:00 de hoje
 * e "manha" finge que é a manhã seguinte, 2 horas depois do resumo. Assim dá para gravar
 * "à noite" e ver o resumo "de manhã" sem esperar.
 */
export function applyTestClock(real: Date, mode: TestClock, morningMinutes: number): Date {
  if (!__DEV__ || mode === 'real') return real;
  const date = new Date(real.getFullYear(), real.getMonth(), real.getDate());
  if (mode === 'noite') {
    date.setHours(23, 0, 0, 0);
  } else {
    date.setDate(date.getDate() + 1);
    date.setMinutes(Math.min(morningMinutes + 120, 23 * 60));
  }
  return date;
}

/** Data atual, atualizada a cada minuto e sempre que o app volta para a frente. */
export function useNow(): Date {
  const { settings } = useSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return applyTestClock(now, settings.testClock, settings.morningMinutes);
}

/** Para usar na hora de um toque (gravar, salvar): devolve a hora certa, com o relógio de teste. */
export function useClock(): () => Date {
  const { settings } = useSettings();
  return () => applyTestClock(new Date(), settings.testClock, settings.morningMinutes);
}
