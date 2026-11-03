import { Directory, File, Paths } from 'expo-file-system';

/** Apaga um arquivo do app pelo endereço dele; se já não existir, não faz nada. */
export function deleteLocalFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // O arquivo já não existe ou não é do app: nada a fazer.
  }
}

/** Apaga um arquivo temporário do app (da pasta de cache, como a foto do seletor). Fora dela, não mexe em nada. */
export function deleteTempFile(uri: string) {
  if (uri.startsWith(Paths.cache.uri)) deleteLocalFile(uri);
}

// Onde ficam as mídias do app: gravações do expo-audio ("Audio" no Android, "ExpoAudio" no iPhone),
// fotos do seletor ("ImagePicker") e as fotos do mural. Nenhuma dessas pastas guarda outra coisa.
const MEDIA_FOLDERS = ['Audio', 'ExpoAudio', 'ImagePicker', 'mural'];

/** Para o "Apagar todos os meus dados": também some com gravações canceladas e fotos não postadas. */
export function deleteAllMedia() {
  for (const base of [Paths.document, Paths.cache]) {
    for (const name of MEDIA_FOLDERS) {
      try {
        const folder = new Directory(base, name);
        if (folder.exists) folder.delete();
      } catch {
        // Pasta inexistente ou em uso: segue para a próxima.
      }
    }
  }
}
