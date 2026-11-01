import { isRunningInExpoGo } from 'expo';

import type { WidgetSettings } from '@/widgets/widget-content';

// Os widgets só existem na versão própria do app (o Expo Go não tem o módulo nativo),
// por isso o código deles só é carregado fora do Expo Go.

export async function syncWidgets(settings: WidgetSettings): Promise<void> {
  if (isRunningInExpoGo()) return;
  const { updateAndroidWidgets } = await import('@/widgets/android/widget-tasks');
  await updateAndroidWidgets(settings);
}

/** No Android o toque no widget já grava a tarefa direto no diário; não há nada a espelhar. */
export function watchWidgetTaps(_onTap: () => void): () => void {
  return () => undefined;
}
