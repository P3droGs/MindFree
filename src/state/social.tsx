import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { social, SocialError, type SocialProfile } from '@/lib/social';
import { useAccount } from '@/state/account';
import { useSettings } from '@/state/settings';

/** off: sem conta de verdade · none: ainda não escolheu o @ · error: sem conexão na primeira vez. */
export type SocialStatus = 'off' | 'loading' | 'none' | 'ready' | 'error';

type SocialValue = {
  status: SocialStatus;
  profile: SocialProfile | null;
  refresh: () => Promise<void>;
  /** Entra na rede (primeira vez) ou troca o @. Lança SocialError (@ inválido, repetido, sem internet). */
  saveHandle: (handle: string) => Promise<void>;
};

const SocialContext = createContext<SocialValue | null>(null);

// O nome, a bio e a conta privada moram nos Ajustes (e sobem com a conta); o perfil público copia daqui.
const publicName = (name: string) => name.trim().slice(0, 60);
const publicBio = (bio: string) => bio.trim().slice(0, 80);

/** A pessoa na rede: o @, os números e os pedidos. Só existe com conta de verdade. */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { account, signedIn } = useAccount();
  const { settings } = useSettings();
  const accountKey = signedIn && account ? account.id : null;
  const [loaded, setLoaded] = useState<{ key: string; status: SocialStatus; profile: SocialProfile | null } | null>(
    null,
  );
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Só vale o que foi carregado para a conta de agora (trocou de conta, começa de novo).
  const current = loaded && loaded.key === accountKey ? loaded : null;
  const status: SocialStatus = accountKey ? (current?.status ?? 'loading') : 'off';
  const profile = current?.profile ?? null;

  /** Busca o perfil da rede. Sem internet: se já tinha o perfil, continua com ele; senão, mostra o aviso. */
  const load = useCallback(
    (key: string) =>
      social.profile().then(
        (next) => setLoaded({ key, status: next ? 'ready' : 'none', profile: next }),
        () =>
          setLoaded((previous) =>
            previous && previous.key === key && previous.profile ? previous : { key, status: 'error', profile: null },
          ),
      ),
    [],
  );

  const refresh = useCallback(async () => {
    if (accountKey) await load(accountKey);
  }, [accountKey, load]);

  const saveHandle = useCallback(
    async (handle: string) => {
      if (!accountKey) throw new SocialError('no_account');
      const next = await social.saveProfile({
        handle,
        name: publicName(settingsRef.current.name),
        bio: publicBio(settingsRef.current.bio),
        private: settingsRef.current.privateAccount,
      });
      setLoaded({ key: accountKey, status: 'ready', profile: next });
    },
    [accountKey],
  );

  // Entrou na conta: busca o perfil da rede. Voltou para o app: atualiza os números e os pedidos.
  useEffect(() => {
    if (!accountKey) return;
    void load(accountKey);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(accountKey);
    });
    return () => subscription.remove();
  }, [accountKey, load]);

  // Mudou o nome, a bio ou a conta privada nos Ajustes ou no Perfil: o perfil público acompanha.
  const name = publicName(settings.name);
  const bio = publicBio(settings.bio);
  const isPrivate = settings.privateAccount;
  const differs = !!profile && (profile.name !== name || profile.bio !== bio || profile.private !== isPrivate);
  useEffect(() => {
    if (!differs || !profile || !accountKey) return;
    const handle = profile.handle;
    const timeout = setTimeout(() => {
      social
        .saveProfile({ handle, name, bio, private: isPrivate })
        .then((next) => setLoaded({ key: accountKey, status: 'ready', profile: next }))
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [differs, profile, accountKey, name, bio, isPrivate]);

  const value: SocialValue = { status, profile, refresh, saveHandle };
  return <SocialContext value={value}>{children}</SocialContext>;
}

export function useSocial(): SocialValue {
  const value = use(SocialContext);
  if (!value) throw new Error('useSocial precisa estar dentro de SocialProvider.');
  return value;
}
