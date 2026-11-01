import type { LanguageCode } from '@/i18n';

// Política de privacidade do MindFree. RASCUNHO: os campos entre colchetes precisam ser
// preenchidos e o texto deve passar por um advogado antes de publicar nas lojas.
// Fica fora dos arquivos de idioma porque é texto jurídico: por enquanto só português e inglês.

export type PolicySection = { title: string; paragraphs: string[] };
export type Policy = { updated: string; draft: string; sections: PolicySection[] };

const CONTROLLER = '[NOME DO RESPONSÁVEL]';
const CONTACT = '[E-MAIL DE CONTATO]';
// Onde fica o projeto do Supabase (Project Settings → General → Region no painel).
const REGION = 'us-east-1';

const pt: Policy = {
  updated: 'Atualizada em 27 de outubro de 2026',
  draft: 'Rascunho em revisão. Esta versão ainda pode mudar antes do lançamento.',
  sections: [
    {
      title: 'Quem cuida dos seus dados',
      paragraphs: [
        `O MindFree é desenvolvido por ${CONTROLLER}, que é o controlador dos seus dados pessoais nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Contato para assuntos de privacidade: ${CONTACT}.`,
      ],
    },
    {
      title: 'O que fica guardado no seu celular',
      paragraphs: [
        'Seu nome, suas preferências (cores, horários e idioma), suas tarefas, as gravações de voz e o texto delas, e as fotos que você posta no mural. Sem conta, tudo isso fica guardado só no seu aparelho.',
        'Se o backup do celular estiver ligado (iCloud ou Google), esses dados podem ir junto no backup da sua conta, conforme as regras da Apple ou do Google.',
      ],
    },
    {
      title: 'Se você criar uma conta',
      paragraphs: [
        `Seu e-mail, sua senha (guardada de forma protegida pela Supabase, nunca em texto puro), seu nome, seus ajustes e suas tarefas e noites ficam guardados nos servidores da Supabase, na região ${REGION}, nos Estados Unidos, para você não perder nada e poder usar o app em outro celular. Ao criar a conta, você concorda com essa transferência internacional dos dados.`,
        'As gravações de voz, o texto do que você falou e as fotos do mural continuam só no seu celular.',
        'Ao sair da conta, as tarefas são apagadas deste celular e continuam na conta. Ao apagar a conta, tudo o que está nela é apagado do servidor.',
      ],
    },
    {
      title: 'Se você entrar na rede (Céu dos amigos)',
      paragraphs: [
        `A rede só existe para quem tem conta e escolhe um @. Ao entrar, ficam nos servidores da Supabase (região ${REGION}, nos Estados Unidos): o seu @, o seu nome, a sua bio, se a conta é privada, quem você segue e quem segue você, os brilhos e cutucões e o seu código de convite.`,
        'Quem você aprovar (conta privada) ou quem seguir você (conta pública) vê só os dias em que você acendeu uma estrela, quantas estrelas você tem no mês e se acendeu hoje. Nunca o que você falou, o texto, as tarefas ou o horário em que gravou.',
        'Qualquer pessoa com conta pode achar você pela busca e ver o seu @, o seu nome e se a conta é privada.',
        'As fotos do mural continuam só no seu celular por enquanto.',
        'Para sair da rede, deixe de seguir as pessoas ou apague a conta (Ajustes → Privacidade → Apagar todos os meus dados): o seu perfil na rede, os seguidores, os brilhos e o código são apagados junto.',
      ],
    },
    {
      title: 'Quando algo sai do seu celular',
      paragraphs: [
        'Só quando a organização com IA está ligada e você grava ou escreve. Nesse momento, o áudio (ou o texto), a data, a hora e o idioma do app são enviados por conexão criptografada ao servidor do MindFree, hospedado na Supabase, que repassa para:',
        '• OpenAI, que transforma a fala em texto;\n• Anthropic, que organiza o texto em tarefas com dia e horário.',
        'O resultado volta para o seu celular. O servidor do MindFree não guarda o áudio, o texto nem as tarefas.',
        'Mesmo sem conta, o app cria um identificador anônimo, sem seu nome nem e-mail, só para contar quantas vezes por dia a IA é usada e evitar abusos.',
        'Na rede (Céu dos amigos), o que é compartilhado e quem vê está na seção "Se você entrar na rede".',
      ],
    },
    {
      title: 'O que a OpenAI e a Anthropic fazem com isso',
      paragraphs: [
        'Pelas políticas atuais das duas empresas, os dados enviados pela API delas não são usados para treinar modelos de IA e são apagados em até 30 dias. Eles podem ser guardados por mais tempo só quando a lei exigir ou para combater abusos.',
        'As duas empresas ficam nos Estados Unidos. Ao ligar a organização com IA, você consente, de forma específica, com essa transferência internacional dos dados.',
      ],
    },
    {
      title: 'Para que usamos seus dados',
      paragraphs: [
        'Só para o app funcionar: organizar suas tarefas, lembrar você nos horários escolhidos e mostrar o seu céu. Não vendemos seus dados, não mostramos anúncios e não criamos perfis sobre você.',
      ],
    },
    {
      title: 'Dados sensíveis',
      paragraphs: [
        'O que você fala pode incluir informações sensíveis, como dados de saúde. Elas são tratadas só para virar tarefas e só com o seu consentimento. Evite falar senhas, números de cartão ou de documentos.',
      ],
    },
    {
      title: 'Seus direitos',
      paragraphs: [
        'Pela LGPD, você pode saber quais dados tratamos e com quem compartilhamos, corrigir, apagar, levar seus dados para outro serviço e retirar o consentimento a qualquer momento, sem custo.',
        `No app: Ajustes → Privacidade, para desligar a organização com IA ou apagar todos os seus dados (e a sua conta, se tiver uma). Para qualquer outro pedido, escreva para ${CONTACT}.`,
      ],
    },
    {
      title: 'Permissões do celular',
      paragraphs: [
        'Microfone: só para gravar quando você toca em gravar. Câmera: só quando você tira uma foto para postar. Notificações: para os lembretes. A galeria abre pelo seletor do próprio sistema, que entrega ao app só a foto que você escolher.',
      ],
    },
    {
      title: 'Crianças',
      paragraphs: ['O MindFree não é destinado a crianças.'],
    },
    {
      title: 'Mudanças nesta política',
      paragraphs: [
        'Se esta política mudar de forma importante, o app avisa e, quando for necessário, pede o seu consentimento de novo.',
      ],
    },
  ],
};

const en: Policy = {
  updated: 'Updated on October 27, 2026',
  draft: 'Draft under review. This version may still change before launch.',
  sections: [
    {
      title: 'Who takes care of your data',
      paragraphs: [
        `MindFree is developed by ${CONTROLLER}, the controller of your personal data under Brazil’s General Data Protection Law (LGPD, Law No. 13,709/2018). Privacy contact: ${CONTACT}.`,
      ],
    },
    {
      title: 'What stays on your phone',
      paragraphs: [
        'Your name, your preferences (colors, times and language), your tasks, your voice recordings and their text, and the photos you post on the wall. Without an account, all of this is stored only on your device.',
        'If your phone backup is on (iCloud or Google), this data may be included in your account’s backup, under Apple’s or Google’s rules.',
      ],
    },
    {
      title: 'If you create an account',
      paragraphs: [
        `Your email, your password (stored securely by Supabase, never in plain text), your name, your settings and your tasks and nights are stored on Supabase servers in the ${REGION} region, in the United States, so you don’t lose anything and can use the app on another phone. By creating an account, you agree to this international transfer of data.`,
        'Voice recordings, the text of what you said and wall photos stay only on your phone.',
        'When you sign out, tasks are deleted from this phone and remain in the account. When you delete the account, everything in it is deleted from the server.',
      ],
    },
    {
      title: 'If you join the network (Friends’ sky)',
      paragraphs: [
        `The network only exists for people with an account who choose an @. When you join, Supabase servers (${REGION} region, in the United States) store: your @, your name, your bio, whether your account is private, who you follow and who follows you, sparkles and nudges, and your invite code.`,
        'People you approve (private account) or who follow you (public account) see only the days you lit a star, how many stars you have this month and whether you lit one today. Never what you said, the text, your tasks or the time you recorded.',
        'Anyone with an account can find you in search and see your @, your name and whether your account is private.',
        'Wall photos stay only on your phone for now.',
        'To leave the network, unfollow people or delete your account (Settings → Privacy → Delete all my data): your network profile, followers, sparkles and code are deleted with it.',
      ],
    },
    {
      title: 'When something leaves your phone',
      paragraphs: [
        'Only when AI organizing is on and you record or write. At that moment, the audio (or the text), the date, the time and the app language are sent over an encrypted connection to the MindFree server, hosted on Supabase, which passes them on to:',
        '• OpenAI, which turns speech into text;\n• Anthropic, which organizes the text into tasks with a day and time.',
        'The result comes back to your phone. The MindFree server does not store the audio, the text or the tasks.',
        'Even without an account, the app creates an anonymous identifier, with no name or email, only to count how many times a day AI is used and to prevent abuse.',
        'On the network (Friends’ sky), what is shared and who sees it is in the section "If you join the network".',
      ],
    },
    {
      title: 'What OpenAI and Anthropic do with it',
      paragraphs: [
        'Under both companies’ current policies, data sent through their APIs is not used to train AI models and is deleted within 30 days. It may be kept longer only when required by law or to fight abuse.',
        'Both companies are in the United States. By turning on AI organizing, you specifically consent to this international transfer of data.',
      ],
    },
    {
      title: 'What we use your data for',
      paragraphs: [
        'Only to make the app work: organize your tasks, remind you at the times you chose and show your sky. We don’t sell your data, show ads or build profiles about you.',
      ],
    },
    {
      title: 'Sensitive data',
      paragraphs: [
        'What you say may include sensitive information, such as health data. It is processed only to become tasks and only with your consent. Avoid saying passwords, card numbers or ID numbers.',
      ],
    },
    {
      title: 'Your rights',
      paragraphs: [
        'Under the LGPD, you can learn what data we process and who we share it with, correct it, delete it, take it to another service and withdraw your consent at any time, free of charge.',
        `In the app: Settings → Privacy, to turn off AI organizing or delete all your data (and your account, if you have one). For any other request, write to ${CONTACT}.`,
      ],
    },
    {
      title: 'Phone permissions',
      paragraphs: [
        'Microphone: only to record when you tap record. Camera: only when you take a photo to post. Notifications: for reminders. The gallery opens through the system’s own picker, which gives the app only the photo you choose.',
      ],
    },
    {
      title: 'Children',
      paragraphs: ['MindFree is not intended for children.'],
    },
    {
      title: 'Changes to this policy',
      paragraphs: [
        'If this policy changes in an important way, the app will let you know and, when needed, ask for your consent again.',
      ],
    },
  ],
};

/** Português para pt-BR e pt-PT; inglês para os outros idiomas, até termos as traduções revisadas. */
export function privacyPolicyFor(language: LanguageCode): { policy: Policy; translated: boolean } {
  if (language === 'pt-BR' || language === 'pt-PT') return { policy: pt, translated: true };
  return { policy: en, translated: language === 'en' };
}
