import { aiConfigured } from '@/lib/organize';
import type { Settings } from '@/state/settings';

/**
 * Versão do texto do consentimento. Se o que é enviado ou para quem mudar,
 * aumente este número: quem tinha aceitado antes vê a tela de novo.
 */
export const CONSENT_VERSION = 1;

/** A voz e o texto só saem do celular com o servidor configurado e o "Concordo" da versão atual. */
export function aiAllowed(settings: Pick<Settings, 'aiConsent' | 'aiConsentVersion'>): boolean {
  return aiConfigured && settings.aiConsent === 'granted' && settings.aiConsentVersion === CONSENT_VERSION;
}

/** Ainda não perguntamos (ou o texto mudou desde o "Concordo"): mostrar a tela antes de gravar. */
export function shouldAskConsent(settings: Pick<Settings, 'aiConsent' | 'aiConsentVersion'>): boolean {
  if (!aiConfigured) return false;
  if (settings.aiConsent === 'unknown') return true;
  return settings.aiConsent === 'granted' && settings.aiConsentVersion !== CONSENT_VERSION;
}
