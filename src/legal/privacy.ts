import type { LanguageCode } from '@/i18n';

// Política de privacidade do MindFree. RASCUNHO: o texto deve passar por um advogado antes de publicar nas lojas.
// Fica fora dos arquivos de idioma porque é texto jurídico: por enquanto só português e inglês.

export type PolicySection = { title: string; paragraphs: string[] };
export type Policy = { updated: string; draft: string; sections: PolicySection[] };

export const CONTROLLER = 'MindFree';
export const CONTACT = 'contato@mindfree.com.br';
// Onde fica o projeto do Supabase (Project Settings → General → Region no painel).
const REGION = 'us-east-1';

const pt: Policy = {
  updated: 'Atualizada em 12 de novembro de 2026',
  draft: 'Rascunho em revisão. Esta versão ainda pode mudar antes do lançamento.',
  sections: [
    {
      title: 'Quem cuida dos seus dados',
      paragraphs: [
        `O app MindFree é desenvolvido pela ${CONTROLLER}, que é a controladora dos seus dados pessoais nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Contato para assuntos de privacidade: ${CONTACT}.`,
      ],
    },
    {
      title: 'O que fica guardado no seu celular',
      paragraphs: [
        'Seu nome, suas preferências (cores, horários e idioma), suas tarefas, as gravações de voz e o texto delas, e as fotos que você posta no mural. Sem conta, tudo isso fica guardado só no seu aparelho.',
        'No Android, o MindFree fica fora do backup automático do Google: esses dados não saem do aparelho. No iPhone, se o backup do iCloud estiver ligado, eles podem ir junto no backup da sua conta, conforme as regras da Apple.',
      ],
    },
    {
      title: 'Se você criar uma conta',
      paragraphs: [
        `Seu e-mail, sua senha (guardada de forma protegida pela Supabase, nunca em texto puro), seu nome, seus ajustes e suas tarefas e noites ficam guardados nos servidores da Supabase, na região ${REGION}, nos Estados Unidos, para você não perder nada e poder usar o app em outro celular. Ao criar a conta, você concorda com essa transferência internacional dos dados.`,
        'Se você entrar com o Google, recebemos do Google o seu nome, o seu e-mail e a foto do seu perfil, para criar a conta. A sua senha do Google não chega até nós.',
        'Os e-mails do app (o código que confirma o cadastro, o de senha nova e o e-mail de boas-vindas) são enviados pela Resend, nos Estados Unidos, que recebe só o seu endereço de e-mail e o conteúdo da mensagem.',
        'As gravações de voz e o texto do que você falou continuam só no seu celular. O áudio de cada gravação é apagado do celular 7 dias depois de organizado; o texto e as tarefas ficam. As fotos do mural só saem dele quando você posta (veja "Se você entrar na rede").',
        'Ao sair da conta, as tarefas são apagadas deste celular e continuam na conta. Ao apagar a conta, tudo o que está nela é apagado do servidor.',
        'Todo dia o servidor guarda uma cópia de segurança do banco, só para recuperar os dados em caso de falha; ela fica por 14 dias, no mesmo servidor, sem as gravações e sem as fotos. Depois disso, o que você apagou some também da cópia.',
      ],
    },
    {
      title: 'Se você entrar na rede (Céu dos amigos)',
      paragraphs: [
        `A rede só existe para quem tem conta e escolhe um @. Ao entrar, ficam nos servidores da Supabase (região ${REGION}, nos Estados Unidos): o seu @, o seu nome, a sua bio, se a conta é privada, quem você segue e quem segue você, os brilhos e cutucões e o seu código de convite.`,
        'Quem você aprovar (conta privada) ou quem seguir você (conta pública) vê só os dias em que você acendeu uma estrela, quantas estrelas você tem no mês e se acendeu hoje. Nunca o que você falou, o texto, as tarefas ou o horário em que gravou.',
        'Qualquer pessoa com conta pode achar você pela busca e ver o seu @, o seu nome e se a conta é privada.',
        'Quando você posta no mural, a foto (reduzida), a tarefa que você escolheu e a legenda vão para os servidores da Supabase. Quem segue você vê o post, quantos brilhos ele tem e quem mandou. Depois de 7 dias, o post e a foto são apagados do servidor, e a sua cópia continua no seu celular, no Perfil. Você pode apagar um post antes disso.',
        'Antes de publicar, a foto e o texto do post passam pelo filtro de moderação da OpenAI, que só responde se o conteúdo vai contra as regras (como nudez, violência ou ódio). Se for, o post não é publicado e a foto é apagada. A equipe do MindFree analisa as denúncias e pode apagar um post ou suspender uma conta na rede; quem foi moderado recebe um aviso no app com o motivo.',
        'Se você bloquear alguém, fica guardado quem bloqueou quem, até você desbloquear. Se você denunciar uma pessoa ou um post, ficam guardados o motivo, o texto que você escrever e, no caso de um post, a tarefa e a legenda dele, só para a equipe do MindFree analisar. A outra pessoa não fica sabendo.',
        'Avisos dos amigos: para avisar você de um brilho, um cutucão, um brilho no Mural ou um pedido para seguir, ficam guardados o endereço de avisos deste celular, quais avisos você quer receber, os seus horários da noite e da manhã, o seu fuso horário e o idioma do app. O aviso passa pelo Expo (Expo Push) e pelo Google (Firebase) ou pela Apple, levando o nome de quem mandou e, no Mural, a tarefa do post. Cada tipo de aviso pode ser desligado em Ajustes → Notificações, e ao sair da conta este celular deixa de receber.',
        'Para sair da rede, deixe de seguir as pessoas ou apague a conta (Ajustes → Privacidade → Apagar todos os meus dados): o seu perfil na rede, os seguidores, os brilhos, os posts e as fotos do mural, os bloqueios, as denúncias que você fez e o código são apagados junto.',
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
      title: 'Site e lista de espera',
      paragraphs: [
        'O site mindfree.com.br é hospedado pela Cloudflare, nos Estados Unidos. Para entregar as páginas e proteger o site, a Cloudflare trata dados técnicos do acesso, como o endereço IP. O site não usa cookies próprios, anúncios nem ferramentas de análise de visitas; a Cloudflare pode usar cookies estritamente técnicos, de segurança.',
        'Se você entrar na lista de espera, guardamos o seu e-mail, o idioma da página, a data em que você concordou e a versão do texto com que você concordou, além de um código aleatório que identifica o seu link de saída. Usamos esses dados só para avisar quando o MindFree chegar às lojas e quando o MindFree Plus for lançado. A base legal é o seu consentimento, e os dados ficam num banco de dados da Cloudflare.',
        'Para evitar abusos do formulário, calculamos um código a partir do seu endereço IP, que não permite recuperar o endereço, e o guardamos por até 2 dias.',
        `Você sai da lista quando quiser, pelo link que vai em cada e-mail ou escrevendo para ${CONTACT}. A lista inteira é apagada em até 30 dias depois do aviso de lançamento do MindFree Plus.`,
      ],
    },
    {
      title: 'Quem nos ajuda a operar o app',
      paragraphs: [
        'Estas empresas tratam dados em nosso nome (são os operadores), cada uma só para prestar o seu serviço ao MindFree:',
        '• Supabase (Estados Unidos): servidor, banco de dados, login e as fotos do mural;\n• OpenAI (Estados Unidos): transforma a fala em texto;\n• Anthropic (Estados Unidos): organiza o texto em tarefas;\n• Resend (Estados Unidos): envia os e-mails de confirmação e de senha nova;\n• Cloudflare (Estados Unidos): hospeda o site mindfree.com.br e guarda a lista de espera;\n• Expo (Estados Unidos): entrega os avisos dos amigos (push) ao Google e à Apple, usando o identificador de notificações do seu celular.',
        `Se você escrever para ${CONTACT}, a mensagem passa pela Cloudflare e chega à nossa caixa de e-mail no Google.`,
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
        `No app: Ajustes → Privacidade, para exportar os seus dados num arquivo ("Exportar meus dados"), desligar a organização com IA ou apagar todos os seus dados (e a sua conta, se tiver uma). Para qualquer outro pedido, escreva para ${CONTACT}.`,
      ],
    },
    {
      title: 'Permissões do celular',
      paragraphs: [
        'Microfone: só para gravar quando você toca em gravar. Câmera: só quando você tira uma foto para postar. Notificações: para os lembretes. Alarmes e lembretes (Android): só para cada lembrete chegar no minuto certo. A galeria abre pelo seletor do próprio sistema, que entrega ao app só a foto que você escolher.',
      ],
    },
    {
      title: 'Crianças',
      paragraphs: [
        `O MindFree não é destinado a menores de 13 anos. Para criar uma conta e entrar na rede é preciso ter 13 anos ou mais, e o cadastro pede essa confirmação. Não coletamos de propósito dados de crianças; se soubermos de uma conta de alguém com menos de 13 anos, ela é apagada. Pais e responsáveis podem escrever para ${CONTACT}.`,
      ],
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
  updated: 'Updated on November 12, 2026',
  draft: 'Draft under review. This version may still change before launch.',
  sections: [
    {
      title: 'Who takes care of your data',
      paragraphs: [
        `The MindFree app is developed by ${CONTROLLER}, the controller of your personal data under Brazil’s General Data Protection Law (LGPD, Law No. 13,709/2018). Privacy contact: ${CONTACT}.`,
      ],
    },
    {
      title: 'What stays on your phone',
      paragraphs: [
        'Your name, your preferences (colors, times and language), your tasks, your voice recordings and their text, and the photos you post on the wall. Without an account, all of this is stored only on your device.',
        'On Android, MindFree is excluded from Google’s automatic backup: this data does not leave the device. On iPhone, if iCloud backup is on, it may be included in your account’s backup, under Apple’s rules.',
      ],
    },
    {
      title: 'If you create an account',
      paragraphs: [
        `Your email, your password (stored securely by Supabase, never in plain text), your name, your settings and your tasks and nights are stored on Supabase servers in the ${REGION} region, in the United States, so you don’t lose anything and can use the app on another phone. By creating an account, you agree to this international transfer of data.`,
        'If you sign in with Google, we receive your name, email and profile picture from Google to create the account. Your Google password never reaches us.',
        'The app’s emails (the code that confirms sign-up, the new-password code and the welcome email) are sent by Resend, in the United States, which receives only your email address and the message content.',
        'Voice recordings and the text of what you said stay only on your phone. The audio of each recording is deleted from the phone 7 days after it is organized; the text and the tasks remain. Wall photos leave it only when you post (see "If you join the network").',
        'When you sign out, tasks are deleted from this phone and remain in the account. When you delete the account, everything in it is deleted from the server.',
        'Every day the server keeps a backup copy of the database, only to recover data in case of failure; it is kept for 14 days, on the same server, without recordings or photos. After that, what you deleted is gone from the copy as well.',
      ],
    },
    {
      title: 'If you join the network (Friends’ sky)',
      paragraphs: [
        `The network only exists for people with an account who choose an @. When you join, Supabase servers (${REGION} region, in the United States) store: your @, your name, your bio, whether your account is private, who you follow and who follows you, sparkles and nudges, and your invite code.`,
        'People you approve (private account) or who follow you (public account) see only the days you lit a star, how many stars you have this month and whether you lit one today. Never what you said, the text, your tasks or the time you recorded.',
        'Anyone with an account can find you in search and see your @, your name and whether your account is private.',
        'When you post on the wall, the photo (downsized), the task you chose and the caption go to Supabase servers. People who follow you see the post, how many sparkles it has and who sent them. After 7 days, the post and the photo are deleted from the server, and your copy stays on your phone, on your Profile. You can delete a post before then.',
        'Before a post is published, its photo and text go through OpenAI’s moderation filter, which only answers whether the content breaks the rules (such as nudity, violence or hate). If it does, the post is not published and the photo is deleted. The MindFree team reviews reports and may delete a post or suspend an account from the network; whoever was moderated gets a notice in the app with the reason.',
        'If you block someone, we keep a record of who blocked whom until you unblock. If you report a person or a post, we keep the reason, any text you write and, for a post, its task and caption, only for the MindFree team to review. The other person is not told.',
        'Friends’ alerts: to tell you about a sparkle, a nudge, a sparkle on the wall or a follow request, we store this phone’s alert address, which alerts you want, your evening and morning times, your time zone and the app language. The alert goes through Expo (Expo Push) and Google (Firebase) or Apple, carrying the sender’s name and, for the wall, the post’s task. Each kind of alert can be turned off in Settings → Notifications, and when you sign out this phone stops receiving them.',
        'To leave the network, unfollow people or delete your account (Settings → Privacy → Delete all my data): your network profile, followers, sparkles, wall posts and photos, blocks, the reports you made and your code are deleted with it.',
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
      title: 'Website and waitlist',
      paragraphs: [
        'The website mindfree.com.br is hosted by Cloudflare, in the United States. To deliver the pages and protect the site, Cloudflare processes technical access data, such as the IP address. The site does not use its own cookies, ads or visitor analytics tools; Cloudflare may use strictly technical security cookies.',
        'If you join the waitlist, we keep your email, the page language, the date you agreed and the version of the text you agreed to, plus a random code that identifies your unsubscribe link. We use this data only to let you know when MindFree reaches the stores and when MindFree Plus launches. The legal basis is your consent, and the data is kept in a Cloudflare database.',
        'To prevent abuse of the form, we compute a code from your IP address, which does not allow the address to be recovered, and keep it for up to 2 days.',
        `You can leave the list whenever you want, through the link in every email or by writing to ${CONTACT}. The whole list is deleted within 30 days after the MindFree Plus launch notice.`,
      ],
    },
    {
      title: 'Who helps us run the app',
      paragraphs: [
        'These companies process data on our behalf (they are our processors), each one only to provide its service to MindFree:',
        '• Supabase (United States): server, database, sign-in and the wall photos;\n• OpenAI (United States): turns speech into text;\n• Anthropic (United States): organizes the text into tasks;\n• Resend (United States): sends the confirmation and new-password emails;\n• Cloudflare (United States): hosts the website mindfree.com.br and stores the waitlist;\n• Expo (United States): delivers friends’ notifications (push) to Google and Apple, using your phone’s notification identifier.',
        `If you write to ${CONTACT}, the message goes through Cloudflare and reaches our mailbox at Google.`,
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
        `In the app: Settings → Privacy, to export your data to a file ("Export my data"), turn off AI organizing or delete all your data (and your account, if you have one). For any other request, write to ${CONTACT}.`,
      ],
    },
    {
      title: 'Phone permissions',
      paragraphs: [
        'Microphone: only to record when you tap record. Camera: only when you take a photo to post. Notifications: for reminders. Alarms & reminders (Android): only so each reminder arrives at the exact minute. The gallery opens through the system’s own picker, which gives the app only the photo you choose.',
      ],
    },
    {
      title: 'Children',
      paragraphs: [
        `MindFree is not intended for children under 13. To create an account and join the network you must be 13 or older, and sign-up asks you to confirm it. We do not knowingly collect children’s data; if we learn of an account belonging to someone under 13, it is deleted. Parents and guardians can write to ${CONTACT}.`,
      ],
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
