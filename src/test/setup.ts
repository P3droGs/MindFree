// Roda antes de cada arquivo de teste (o ambiente de mentira está em env.ts, que roda antes).
import Storage from 'expo-sqlite/kv-store';

beforeEach(() => {
  (Storage as unknown as { __reset: () => void }).__reset();
});

/** Um `t` de mentira: devolve a chave com os parâmetros, para os testes conferirem qual texto foi pedido. */
export const fakeT = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')})` : key;
