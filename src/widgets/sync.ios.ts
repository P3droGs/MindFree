import { isRunningInExpoGo } from 'expo';

import type { WidgetSettings } from '@/widgets/widget-content';

// Os widgets só existem na versão própria do app (o Expo Go não tem o módulo nativo),
// por isso o código deles só é carregado fora do Expo Go.

export async function syncWidgets(settings: WidgetSettings): Promise<void> {
  if (isRunningInExpoGo()) return;
  const { updateTimelines } = await import('@/widgets/ios/timeline');
  await updateTimelines(settings);
}

/** Avisa quando a pessoa marca uma tarefa no widget com o app aberto. */
export function watchWidgetTaps(onTap: () => void): () => void {
  if (isRunningInExpoGo()) return () => undefined;
  let subscription: { remove: () => void } | undefined;
  let stopped = false;
  import('@/widgets/ios/timeline')
    .then(({ listenToWidgetTaps }) => {
      if (!stopped) subscription = listenToWidgetTaps(onTap);
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    subscription?.remove();
  };
}
