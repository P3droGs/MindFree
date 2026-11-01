import type { WidgetSettings } from '@/widgets/widget-content';

// Na web não há widgets. As versões de verdade estão em sync.ios.ts e sync.android.ts.

export async function syncWidgets(_settings: WidgetSettings): Promise<void> {}

export function watchWidgetTaps(_onTap: () => void): () => void {
  return () => undefined;
}
