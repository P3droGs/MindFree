import { addUserInteractionListener } from 'expo-widgets';

import { loadJournal, saveJournal, setTaskDone, type Journal } from '@/state/journal';
import { MindFreeWidget } from '@/widgets/ios/mindfree-widget';
import { SkyWidget } from '@/widgets/ios/sky-widget';
import { buildWidgetProps, nextModeChanges, type WidgetSettings } from '@/widgets/widget-content';

/** Uma semana de trocas entre dia e noite; o app refaz a agenda sempre que é aberto. */
const MODE_CHANGES_AHEAD = 14;

/**
 * O widget guarda sozinho as tarefas marcadas nele, mesmo com o app fechado.
 * Antes de mandar uma agenda nova, o app traz essas marcações para o diário.
 */
async function pullWidgetChanges(journal: Journal): Promise<Journal> {
  const entries = await MindFreeWidget.getTimeline();
  let updated = journal;
  for (const entry of entries) {
    for (const task of entry.props.tasks ?? []) {
      const saved = updated.tasks.find((candidate) => candidate.id === task.id);
      if (saved && task.changedAt > saved.changedAt) {
        updated = setTaskDone(updated, task.id, task.done, task.changedAt);
      }
    }
  }
  if (updated !== journal) await saveJournal(updated);
  return updated;
}

export async function updateTimelines(settings: WidgetSettings): Promise<void> {
  const journal = await pullWidgetChanges(loadJournal());
  const now = new Date();
  const dates = [now, ...nextModeChanges(now, settings.nightMinutes, settings.morningMinutes, MODE_CHANGES_AHEAD)];
  const entries = dates.map((date) => ({ date, props: buildWidgetProps(journal, settings, date) }));

  MindFreeWidget.updateTimeline(entries.map(({ date, props }) => ({ date, props: props.mindfree })));
  SkyWidget.updateTimeline(entries.map(({ date, props }) => ({ date, props: props.sky })));
}

export function listenToWidgetTaps(onTap: () => void): { remove: () => void } {
  return addUserInteractionListener(onTap);
}
