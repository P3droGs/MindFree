import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

/**
 * Entrar com o Google: o celular pede a conta Google e devolve um token de identidade, que o Supabase troca por
 * um login. O id do cliente web vem do mesmo projeto do Firebase (Google Cloud) e não é segredo: ele vai dentro
 * do app. Sem ele, o botão avisa que o login com Google não está disponível.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const googleConfigured = WEB_CLIENT_ID.length > 0;

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

export type GoogleResult =
  | { status: 'ok'; idToken: string; name: string | null }
  | { status: 'cancelled' | 'unavailable' | 'failed' };

/** Abre a escolha de conta do Google. "unavailable" quando o celular não tem o Google Play Services ou falta o id. */
export async function googleIdToken(): Promise<GoogleResult> {
  if (!googleConfigured) return { status: 'unavailable' };
  try {
    configure();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: 'cancelled' };
    const { idToken, user } = response.data;
    if (!idToken) return { status: 'failed' };
    return { status: 'ok', idToken, name: user.name ?? user.givenName ?? null };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { status: 'cancelled' };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { status: 'unavailable' };
    }
    return { status: 'failed' };
  }
}

/** Esquece a conta Google escolhida neste celular (ao sair da conta), para a próxima vez perguntar de novo. */
export async function googleForget(): Promise<void> {
  if (!googleConfigured) return;
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Sem conta Google guardada: nada a fazer.
  }
}
