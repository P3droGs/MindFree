import { isRunningInExpoGo } from 'expo';

type WidgetLibrary = typeof import('react-native-android-widget');
type WidgetTasks = typeof import('@/widgets/android/widget-tasks');

/** Liga o Android ao código que desenha os widgets. Precisa rodar assim que o app abre. */
export function registerWidgets(): void {
  // O módulo nativo dos widgets não existe no Expo Go; importar a biblioteca lá fecharia o app.
  // Por isso ela é carregada só aqui, na hora (e de forma síncrona, antes de o Android pedir um widget).
  if (isRunningInExpoGo()) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as WidgetLibrary;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require('@/widgets/android/widget-tasks') as WidgetTasks;
  registerWidgetTaskHandler(widgetTaskHandler);
}
