import type { MessageKey } from '@/i18n';
import type { AuthFailure } from '@/state/account';

/** O que dizer para a pessoa quando entrar ou criar conta não dá certo. */
export const AUTH_FAILURE_TEXT: Record<AuthFailure, MessageKey> = {
  credentials: 'auth.wrongCredentials',
  taken: 'auth.emailTaken',
  weak: 'auth.weakPassword',
  busy: 'auth.busy',
  network: 'auth.networkError',
  unavailable: 'auth.unavailable',
  confirm: 'auth.confirmNeeded',
  code: 'code.wrong',
  unknown: 'auth.genericError',
};
