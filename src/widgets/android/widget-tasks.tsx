'use no memo';

import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { loadJournal, saveJournal, setTaskDone, type Journal } from '@/state/journal';
import { loadSettings } from '@/state/settings';
import { ANDROID_WIDGET_NAMES, renderAndroidWidget, TOGGLE_TASK } from '@/widgets/android/widgets';
import { buildWidgetProps, type WidgetSettings } from '@/widgets/widget-content';

/** Redesenha os widgets do MindFree que estiverem na tela inicial. */
export async function updateAndroidWidgets(
  settings: WidgetSettings,
  journal: Journal = loadJournal(),
  except?: string,
): Promise<void> {
  const props = buildWidgetProps(journal, settings, new Date());
  await Promise.all(
    ANDROID_WIDGET_NAMES.filter((name) => name !== except).map((widgetName) =>
      requestWidgetUpdate({ widgetName, renderWidget: () => renderAndroidWidget(widgetName, props) }),
    ),
  );
}

/**
 * Chamado pelo Android quando um widget é adicionado, redimensionado, tocado ou na
 * atualização a cada 30 minutos (é ela que troca o widget entre o dia e a noite).
 */
export async function widgetTaskHandler({
  widgetInfo,
  widgetAction,
  clickAction,
  clickActionData,
  renderWidget,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;

  const settings = loadSettings();
  let journal = loadJournal();
  const taskId = clickActionData?.id;

  if (widgetAction === 'WIDGET_CLICK' && clickAction === TOGGLE_TASK && typeof taskId === 'string') {
    const task = journal.tasks.find((candidate) => candidate.id === taskId);
    if (task) {
      journal = setTaskDone(journal, task.id, !task.done);
      await saveJournal(journal);
      await updateAndroidWidgets(settings, journal, widgetInfo.widgetName);
    }
  }

  renderWidget(renderAndroidWidget(widgetInfo.widgetName, buildWidgetProps(journal, settings, new Date())));
}
