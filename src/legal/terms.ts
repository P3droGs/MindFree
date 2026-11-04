import type { LanguageCode } from '@/i18n';
import { CONTACT, CONTROLLER, type Policy } from '@/legal/privacy';

// Termos de uso do MindFree. RASCUNHO: os campos entre colchetes vêm da política de privacidade e o
// texto deve passar por um advogado antes de publicar nas lojas. Como a política, fica fora dos
// arquivos de idioma por ser texto jurídico: por enquanto só português e inglês.

/** A idade mínima para criar conta e entrar na rede. O cadastro pede essa confirmação. */
export const MINIMUM_AGE = 13;

const pt: Policy = {
  updated: 'Atualizados em 4 de novembro de 2026',
  draft: 'Rascunho em revisão. Esta versão ainda pode mudar antes do lançamento.',
  sections: [
    {
      title: 'Sobre estes termos',
      paragraphs: [
        `O MindFree é oferecido por ${CONTROLLER}. Ao usar o app, e em especial ao criar uma conta, você aceita estes termos e a Política de Privacidade, que explica o que acontece com os seus dados. Se não concordar com algo, não use o app.`,
      ],
    },
    {
      title: 'O que o MindFree é',
      paragraphs: [
        'O MindFree é uma ferramenta para você falar ou escrever o que está na cabeça antes de dormir e receber isso organizado em tarefas com dia, horário e lembrete. É um organizador pessoal.',
        'Ele não é um serviço de saúde, terapia ou tratamento para o sono, e não substitui um profissional. Nada no app é promessa de resultado para o seu sono ou a sua saúde.',
      ],
    },
    {
      title: 'Idade mínima',
      paragraphs: [
        `Para criar uma conta e usar a rede (Céu dos amigos), você precisa ter pelo menos ${MINIMUM_AGE} anos. Ao criar a conta, você declara que tem essa idade. Se tiver menos de 18 anos, use o app com o conhecimento e a autorização dos seus responsáveis.`,
        `Se soubermos de uma conta de alguém com menos de ${MINIMUM_AGE} anos, ela é apagada. Pais e responsáveis podem escrever para ${CONTACT}.`,
      ],
    },
    {
      title: 'Sua conta',
      paragraphs: [
        'A conta é pessoal: use um e-mail seu, guarde a senha e não a empreste. O que for feito com a sua conta é de sua responsabilidade. Se achar que alguém entrou nela, troque a senha pelo app ("Esqueci a senha") e nos avise.',
        'Você pode usar o app sem conta. Nesse caso, tudo fica só no seu celular, e a rede não está disponível.',
      ],
    },
    {
      title: 'O que não pode na rede',
      paragraphs: [
        'A rede existe para compartilhar conquistas com quem você escolhe. Não é permitido:\n• assediar, ameaçar, humilhar ou discriminar alguém;\n• postar nudez, conteúdo sexual, violência ou incitação ao ódio;\n• se passar por outra pessoa ou expor dados de terceiros;\n• postar spam, golpes, propaganda ou conteúdo ilegal;\n• tentar burlar os limites do app ou acessar dados de outras pessoas.',
        'Quem vê algo assim pode denunciar e bloquear. Podemos esconder ou apagar posts, suspender ou encerrar contas que quebrem estas regras, sem aviso quando a situação for grave.',
      ],
    },
    {
      title: 'Seu conteúdo',
      paragraphs: [
        'O que você fala, escreve, grava e posta é seu. Para o app funcionar, você nos dá uma licença limitada para guardar esse conteúdo, mostrá-lo às pessoas que você escolheu (no caso do mural) e processá-lo pelos serviços descritos na Política de Privacidade. Essa licença acaba quando você apaga o conteúdo ou a conta.',
        'Você responde pelo que posta e garante que tem o direito de usar as fotos e os textos que compartilha. Não usamos o seu conteúdo para treinar inteligência artificial nem para publicidade.',
      ],
    },
    {
      title: 'Organização com inteligência artificial',
      paragraphs: [
        'A organização com IA é opcional e só funciona depois do seu consentimento. Ela transcreve o áudio e sugere tarefas, dias e horários, e pode errar: confira o que ficou anotado, em especial datas, horários e nomes. Os lembretes dependem do celular, das permissões e da economia de bateria, e podem não tocar.',
        'Há um limite diário de usos, para manter o serviço disponível para todos. Os fornecedores de IA podem mudar; a Política de Privacidade diz quem são.',
      ],
    },
    {
      title: 'Disponibilidade e mudanças',
      paragraphs: [
        'Fazemos o possível para o app funcionar bem, mas não garantimos que ele estará sempre disponível, sem falhas ou sem interrupções. Recursos podem mudar, ser adicionados ou retirados. Se o serviço precisar ser encerrado, avisaremos com antecedência razoável; o que está no seu celular continua com você.',
      ],
    },
    {
      title: 'Encerrar a conta',
      paragraphs: [
        'Você pode apagar a conta e todos os dados quando quiser, em Ajustes → Privacidade. Nós podemos suspender ou encerrar a conta de quem quebrar estes termos. O que acontece com os dados nesses casos está na Política de Privacidade.',
      ],
    },
    {
      title: 'Responsabilidade',
      paragraphs: [
        'O app é oferecido como está. Nos limites da lei, não respondemos por tarefas ou lembretes perdidos, por decisões tomadas com base no que a IA organizou, nem por perdas indiretas. Nada nestes termos reduz os direitos que o Código de Defesa do Consumidor garante a você.',
      ],
    },
    {
      title: 'Marca e código',
      paragraphs: [
        'O nome MindFree, o logo e o desenho do app pertencem a quem o oferece e não podem ser usados sem autorização. O código-fonte do app é publicado no GitHub, e o uso dele segue a licença indicada lá.',
      ],
    },
    {
      title: 'Lei e contato',
      paragraphs: [
        `Estes termos seguem a lei brasileira. Qualquer dúvida ou problema pode ser tratado primeiro com a gente, por ${CONTACT}. Se for preciso, vale o foro do seu domicílio, como manda o Código de Defesa do Consumidor.`,
      ],
    },
    {
      title: 'Mudanças nestes termos',
      paragraphs: ['Se estes termos mudarem de forma importante, o app avisa antes de a mudança valer. Continuar usando o app depois disso é aceitar a nova versão.'],
    },
  ],
};

const en: Policy = {
  updated: 'Updated on November 4, 2026',
  draft: 'Draft under review. This version may still change before launch.',
  sections: [
    {
      title: 'About these terms',
      paragraphs: [
        `MindFree is offered by ${CONTROLLER}. By using the app, and especially by creating an account, you accept these terms and the Privacy Policy, which explains what happens to your data. If you disagree with something, please do not use the app.`,
      ],
    },
    {
      title: 'What MindFree is',
      paragraphs: [
        'MindFree is a tool for saying or writing what is on your mind before bed and getting it back organized into tasks with a day, a time and a reminder. It is a personal organizer.',
        'It is not a health service, therapy or a sleep treatment, and it does not replace a professional. Nothing in the app is a promise about your sleep or your health.',
      ],
    },
    {
      title: 'Minimum age',
      paragraphs: [
        `To create an account and use the network (Friends’ sky), you must be at least ${MINIMUM_AGE} years old. By creating an account, you declare that you are. If you are under 18, use the app with the knowledge and permission of your parents or guardians.`,
        `If we learn of an account belonging to someone under ${MINIMUM_AGE}, it is deleted. Parents and guardians can write to ${CONTACT}.`,
      ],
    },
    {
      title: 'Your account',
      paragraphs: [
        'The account is personal: use your own email, keep your password safe and do not lend it. What is done with your account is your responsibility. If you think someone got into it, change the password in the app ("Forgot password?") and let us know.',
        'You can use the app without an account. Then everything stays on your phone only, and the network is not available.',
      ],
    },
    {
      title: 'What is not allowed in the network',
      paragraphs: [
        'The network exists to share achievements with people you choose. It is not allowed to:\n• harass, threaten, humiliate or discriminate against anyone;\n• post nudity, sexual content, violence or incitement to hatred;\n• impersonate someone else or expose other people’s data;\n• post spam, scams, advertising or illegal content;\n• try to get around the app’s limits or access other people’s data.',
        'Anyone who sees something like this can report and block. We may hide or delete posts and suspend or close accounts that break these rules, without notice when the situation is serious.',
      ],
    },
    {
      title: 'Your content',
      paragraphs: [
        'What you say, write, record and post is yours. For the app to work, you give us a limited license to store that content, show it to the people you chose (in the case of the wall) and process it through the services described in the Privacy Policy. This license ends when you delete the content or the account.',
        'You are responsible for what you post and you confirm that you have the right to use the photos and text you share. We do not use your content to train artificial intelligence or for advertising.',
      ],
    },
    {
      title: 'Organizing with artificial intelligence',
      paragraphs: [
        'Organizing with AI is optional and only works after your consent. It transcribes the audio and suggests tasks, days and times, and it can be wrong: check what was written down, especially dates, times and names. Reminders depend on the phone, its permissions and battery saving, and may not ring.',
        'There is a daily limit of uses, to keep the service available for everyone. The AI providers may change; the Privacy Policy says who they are.',
      ],
    },
    {
      title: 'Availability and changes',
      paragraphs: [
        'We do our best to keep the app working well, but we do not guarantee that it will always be available, free of failures or uninterrupted. Features may change, be added or removed. If the service has to be shut down, we will give reasonable notice; what is on your phone stays with you.',
      ],
    },
    {
      title: 'Closing the account',
      paragraphs: [
        'You can delete the account and all data whenever you want, in Settings → Privacy. We may suspend or close the account of anyone who breaks these terms. What happens to the data in those cases is in the Privacy Policy.',
      ],
    },
    {
      title: 'Liability',
      paragraphs: [
        'The app is offered as is. Within the limits of the law, we are not responsible for lost tasks or reminders, for decisions made based on what the AI organized, or for indirect losses. Nothing in these terms reduces the rights that consumer protection law guarantees you.',
      ],
    },
    {
      title: 'Brand and code',
      paragraphs: [
        'The MindFree name, logo and app design belong to the party offering it and cannot be used without permission. The app’s source code is published on GitHub, and its use follows the license stated there.',
      ],
    },
    {
      title: 'Law and contact',
      paragraphs: [
        `These terms follow Brazilian law. Any question or problem can be handled with us first, through ${CONTACT}. If needed, the courts of your place of residence apply, as Brazilian consumer law requires.`,
      ],
    },
    {
      title: 'Changes to these terms',
      paragraphs: ['If these terms change in an important way, the app lets you know before the change takes effect. Continuing to use the app after that means accepting the new version.'],
    },
  ],
};

/** Português para pt-BR e pt-PT; inglês para os outros idiomas, até termos as traduções revisadas. */
export function termsFor(language: LanguageCode): { terms: Policy; translated: boolean } {
  if (language === 'pt-BR' || language === 'pt-PT') return { terms: pt, translated: true };
  return { terms: en, translated: language === 'en' };
}
