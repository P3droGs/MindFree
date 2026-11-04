// O `expo-sqlite/kv-store` de mentira para os testes: um Map em memória com a mesma interface.
const store = new Map<string, string>();

const Storage = {
  getItemSync: (key: string) => store.get(key) ?? null,
  setItemSync: (key: string, value: string) => {
    store.set(key, value);
  },
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  /** Só nos testes: esvazia tudo entre um caso e outro. */
  __reset: () => store.clear(),
};

export default Storage;
