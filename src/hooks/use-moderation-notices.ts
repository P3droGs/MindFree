import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import { useT, type MessageKey } from '@/i18n';
import { social, type ModerationNotice } from '@/lib/social';
import { useSocial } from '@/state/social';

const REASON_TEXT: Record<string, MessageKey> = {
  spam: 'safety.reasonSpam',
  offensive: 'safety.reasonOffensive',
  harassment: 'safety.reasonHarassment',
  other: 'safety.reasonOther',
};

/**
 * Mostra, uma vez cada, os avisos da moderação: um post apagado, a conta suspensa ou reativada.
 * Confere ao abrir e ao voltar para o app; vale também com a conta suspensa.
 */
export function useModerationNotices() {
  const t = useT();
  const { status, refresh } = useSocial();
  const active = status === 'ready' || status === 'suspended';
  const latest = useRef({ t, refresh });
  useEffect(() => {
    latest.current = { t, refresh };
  }, [t, refresh]);

  useEffect(() => {
    if (!active) return;
    let busy = false;
    const show = (notice: ModerationNotice) => {
      const tr = latest.current.t;
      const reason = tr(REASON_TEXT[notice.reason] ?? 'safety.reasonOther');
      if (notice.kind === 'post_removed') {
        Alert.alert(tr('moderation.removedTitle'), tr('moderation.removedBody', { task: notice.detail, reason }));
      } else if (notice.kind === 'suspended') {
        Alert.alert(tr('moderation.suspendedTitle'), tr('moderation.suspendedNotice', { reason }));
      } else {
        Alert.alert(tr('moderation.backTitle'), tr('moderation.backBody'));
      }
    };
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const notices = await social.notices();
        for (const notice of notices) {
          show(notice);
          await social.noticeSeen(notice.id);
        }
        // Suspensa ou reativada: o perfil muda e a parte social troca de tela.
        if (notices.some((notice) => notice.kind !== 'post_removed')) await latest.current.refresh();
      } catch {
        // Sem internet: tenta de novo na próxima vez que o app abrir.
      } finally {
        busy = false;
      }
    };
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, [active]);
}
