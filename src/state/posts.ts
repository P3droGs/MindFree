import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { deleteLocalFile } from '@/lib/files';

/** Uma conquista postada no mural: a tarefa concluída e a foto. */
export type Post = {
  id: string;
  taskTitle: string;
  caption: string;
  photoUri: string;
  createdAt: number;
  /** O post no servidor. Os posts de antes do Mural na nuvem não têm: ficaram só no celular. */
  cloudId?: string;
};

const STORAGE_KEY = 'mindfree.posts.v1';
/** No mural (e no servidor), cada post fica 7 dias. No perfil, fica para sempre, só no celular. */
export const POST_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function loadPosts(): Post[] {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Post[]) : [];
  } catch {
    return [];
  }
}

function savePosts(posts: Post[]): Promise<void> {
  return Storage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

// Os posts são lidos uma vez e ficam em memória; mural, perfil e postar veem a mesma lista.
let cache: Post[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): Post[] {
  cache ??= loadPosts();
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function changePosts(update: (current: Post[]) => Post[]) {
  cache = update(snapshot());
  savePosts(cache).catch(() => undefined);
  for (const listener of listeners) listener();
}

/** Os posts da pessoa, do mais novo para o mais antigo. */
export function usePosts(): Post[] {
  return useSyncExternalStore(subscribe, snapshot);
}

/**
 * A foto escolhida fica numa pasta temporária, que o sistema pode limpar.
 * Copia para a pasta do app para o post não perder a imagem.
 */
export async function keepPhoto(uri: string, id: string): Promise<string> {
  try {
    const folder = new Directory(Paths.document, 'mural');
    if (!folder.exists) folder.create({ intermediates: true });
    const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg';
    const target = new File(folder, `${id}.${extension.length <= 4 ? extension : 'jpg'}`);
    await new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

export function deletePhoto(uri: string) {
  deleteLocalFile(uri);
}
