import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { deleteLocalFile } from '@/lib/files';
import { call, SocialError, type ReportReason, type SocialFailure } from '@/lib/social';
import { supabase, supabaseKey, supabaseUrl } from '@/lib/supabase';

/** Um post do mural na nuvem (seu ou de quem você segue), como o servidor manda. */
export type CloudPost = {
  id: string;
  authorId: string;
  handle: string;
  name: string;
  mine: boolean;
  taskTitle: string;
  caption: string;
  photoPath: string;
  createdAt: string;
  iShined: boolean;
  /** Brilhos dos outros (sem contar você). */
  shines: number;
  /** Os nomes dos últimos que brilharam (até 2, sem você). */
  shinedBy: string[];
};

const BUCKET = 'mural';
/** A foto sobe com no máximo 1080 px de largura: fica leve para enviar e para os amigos baixarem. */
const PHOTO_WIDTH = 1080;
/** Os links das fotos valem 1 hora; o mural pede outros quando abre de novo. */
const LINK_SECONDS = 60 * 60;

/** Reduz a foto e envia para a sua pasta no Storage. Devolve o caminho dela lá. */
async function uploadPhoto(localUri: string, userId: string): Promise<string> {
  const context = ImageManipulator.manipulate(localUri);
  const image = await context.resize({ width: PHOTO_WIDTH }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  try {
    const body = await new File(saved.uri).arrayBuffer();
    const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase!.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
    if (error) throw new SocialError(/limit|quota|row-level/i.test(error.message) ? 'too_many' : 'network');
    return path;
  } finally {
    deleteLocalFile(saved.uri);
  }
}

export const mural = {
  feed: () => call<CloudPost[]>('mural_feed'),

  /**
   * Envia a foto e cria o post pela função "postar", que antes passa a foto e o texto pelo filtro de
   * moderação. Se o post não for criado, a foto enviada é apagada.
   */
  publish: async (localUri: string, task: string, caption: string): Promise<CloudPost> => {
    if (!supabase) throw new SocialError('network');
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    const token = data.session?.access_token;
    if (!userId || !token) throw new SocialError('no_account');
    let path: string;
    try {
      path = await uploadPhoto(localUri, userId);
    } catch (error) {
      throw error instanceof SocialError ? error : new SocialError('network');
    }
    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/postar`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: path, task, caption }),
      });
    } catch {
      response = new Response(JSON.stringify({ error: 'network' }), { status: 503 });
    }
    const result = (await response.json().catch(() => ({}))) as CloudPost & { error?: SocialFailure };
    if (response.ok && result.id) return result;
    // Barrado pelo filtro, a função já apagou a foto; nos outros casos, o app apaga.
    if (result.error !== 'flagged') await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw new SocialError(result.error ?? 'unknown');
  },

  shine: (postId: string, on: boolean) => call<void>('mural_shine', { p_post: postId, p_on: on }),

  /** Apaga o post e a foto dele do servidor. */
  remove: async (postId: string) => {
    const path = await call<string | null>('mural_delete', { p_post: postId });
    if (path && supabase) await supabase.storage.from(BUCKET).remove([path]);
  },

  report: (postId: string, reason: ReportReason, details: string) =>
    call<void>('mural_report', { p_post: postId, p_reason: reason, p_details: details }),

  /** Links temporários para abrir as fotos. O Storage só assina as que você pode ver. */
  photoLinks: async (paths: string[]): Promise<Record<string, string>> => {
    if (!supabase || paths.length === 0) return {};
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
    if (error || !data) return {};
    const links: Record<string, string> = {};
    for (const item of data) if (item.path && item.signedUrl) links[item.path] = item.signedUrl;
    return links;
  },

  /** Ao apagar a conta: tira todas as suas fotos do servidor antes. */
  removeAllMine: async (userId: string) => {
    if (!supabase) return;
    const folder = supabase.storage.from(BUCKET);
    for (let round = 0; round < 10; round += 1) {
      const { data, error } = await folder.list(userId, { limit: 100 });
      if (error || !data || data.length === 0) return;
      const { error: removeError } = await folder.remove(data.map((item) => `${userId}/${item.name}`));
      if (removeError) return;
    }
  },
};
