/**
 * O que a pessoa acabou de gravar ou escrever, entregue ao "Anotado!" por dentro do app.
 * Não vai pelo endereço da tela de propósito: um link de fora (mindfree://anotado?...)
 * não pode criar tarefas nem mandar arquivos para o servidor.
 */
export type CaptureInput = { via: 'voz'; audioUri: string | null } | { via: 'texto'; text: string };

let pending: CaptureInput | null = null;

export function handOffCapture(input: CaptureInput) {
  pending = input;
}

/** Lê sem apagar (a tela pode montar duas vezes no modo de desenvolvimento). */
export function peekCapture(): CaptureInput | null {
  return pending;
}

export function clearCapture() {
  pending = null;
}
