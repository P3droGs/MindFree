# MindFree

**Antes de dormir, fale o que está na sua cabeça. De manhã, está tudo organizado.**

O MindFree é um app para iPhone e Android que ajuda a dormir tranquilo sem medo de esquecer nada. À noite, a pessoa fala por cerca de um minuto tudo o que está ocupando a mente, como "pagar o boleto, ligar pro dentista amanhã às 3, comprar presente da Ana". O app transforma isso em tarefas com dia, horário e lembrete. De manhã, chega um resumo com o dia já organizado.

O visual é calmo e fácil de entender: escuro e lilás à noite, claro e cor de sol de manhã.

---

## O que o app faz

### O ritual da noite
- **Lembrete diário** no horário que a pessoa escolhe, para esvaziar a mente.
- **Gravar ou escrever:**
  - a gravação tem meta de 1 minuto e vai até 3;
  - quem preferir pode escrever, uma coisa por linha.
- **A IA organiza:** a voz vira texto, e o texto vira tarefas com dia e horário ("amanhã às 15h", "sexta", "hoje à noite").
- **Sem IA, também funciona:** um organizador no próprio celular entende datas e horários no texto escrito, e as gravações ficam guardadas para organizar depois.
- **"Anotado!":** a tela final mostra quantas coisas saíram da cabeça, para a pessoa ir dormir.

### O dia
- **Resumo da manhã** com as tarefas do dia, no horário escolhido.
- **Lembrete de cada tarefa** que tem horário.
- **Marcar, editar e apagar tarefas** na tela inicial, no calendário ou no widget.
- **Calendário** mês a mês, com o que foi feito em cada dia.

### Seu céu
- **Uma estrela por noite:** cada noite em que a pessoa esvazia a mente acende uma estrela, e cada tarefa concluída daquela noite a deixa mais brilhante.
- **Uma constelação por mês:** no fim do mês, as estrelas viram uma constelação com nome e entram para a coleção. O nome vem de uma lista, e a pessoa pode trocar.
- **Sem culpa:** pulou uma noite? Tudo bem, o céu nunca apaga.

### Céu dos amigos (opcional, com conta)
- **Seguir amigos** pelo @, com contas privadas que aprovam os pedidos.
- **Ver a semana de cada amigo:** só os dias com estrela, nunca o que a pessoa falou nem as tarefas.
- **Brilho e cutucão:** "brilho" para quem acendeu hoje, "cutucar" para lembrar quem ainda não acendeu.
- **Convite por código:** quem entra pelo código e quem convidou ganham uma estrela cadente.
- **Mural de conquistas:** foto e legenda de uma tarefa concluída. Quem segue você vê o post e pode mandar um brilho, com o número e os nomes de quem brilhou. O post some em 7 dias, também do servidor, e a sua cópia fica guardada no Perfil.
- **Segurança na rede:** no "⋯" de cada pessoa dá para remover seguidor, bloquear ou denunciar.
  - **Bloquear** some dos dois lados: desfaz o seguir, apaga os brilhos e esconde da busca, sem avisar a outra pessoa. Dá para desbloquear em Ajustes.
  - **Denunciar** guarda o motivo (Spam, Conteúdo ofensivo, Assédio ou Outro) para a equipe do MindFree analisar, sem a outra pessoa saber.

### Mais
- **Widgets** na tela do celular, no iPhone e no Android: as tarefas de hoje, a próxima tarefa e o Seu céu. À noite, o widget vira um atalho para gravar.
- **Personalização:** qualquer cor de app e de fundo, com ajuste automático de contraste para a leitura continuar confortável.
- **12 idiomas:** português (Brasil e Portugal), inglês, espanhol, francês, alemão, italiano, japonês, coreano, chinês, hindi e árabe (da direita para a esquerda).
- **Conta opcional:** sem conta, tudo fica no celular. Com conta de e-mail, as tarefas e os ajustes sincronizam entre aparelhos.

---

## Privacidade

- **A IA pede consentimento antes do primeiro uso.** O app explica o que sai do celular, para quem e para quê, e "Agora não" não trava nada.
- **As gravações e o texto do que foi falado ficam no celular**, mesmo com conta.
- **As fotos do mural só saem do celular quando a pessoa posta.** Vão reduzidas para um espaço privado no servidor, abrem só para quem segue (por links que expiram em 1 hora) e são apagadas em 7 dias.
- **Na rede, os amigos veem só os dias com estrela e o que a pessoa escolhe postar no mural.** O servidor entrega apenas o que a privacidade promete: as tabelas não aceitam leitura direta, e tudo passa por funções que conferem quem pode ver o quê.
- **As chaves das IAs ficam no servidor**, nunca no app. O uso da IA tem limite por pessoa e por dia.
- **Bloqueios e denúncias são confidenciais:** quem foi bloqueado ou denunciado não fica sabendo, e as denúncias não aparecem no app para ninguém.
- **Apagar todos os dados** (e a conta) é um botão nos Ajustes.

---

## Como é feito

| Parte | Tecnologia |
| --- | --- |
| App | [Expo](https://expo.dev) SDK 58, React Native, TypeScript e Expo Router |
| Dados no celular | expo-sqlite (tarefas e ajustes) e expo-secure-store (sessão) |
| Avisos | expo-notifications, agendados no próprio celular |
| Widgets | expo-widgets (iPhone) e react-native-android-widget (Android) |
| Servidor | [Supabase](https://supabase.com): login, Postgres com RLS, Storage (fotos do mural) e Edge Functions |
| IA | OpenAI `gpt-4o-mini-transcribe` (voz para texto) e Claude (organiza em tarefas) |

---

## Organização das pastas

```
src/
  app/          telas (Expo Router)
  components/   botões, cartões, folhas e a barra da parte social
  state/        ajustes, tarefas e noites, conta e rede
  lib/          IA, datas, avisos, constelações e chamadas da rede
  widgets/      widgets do iPhone (ios/) e do Android (android/)
  i18n/         os 12 idiomas
  legal/        política de privacidade
supabase/
  functions/    as Edge Functions "organizar" (IA) e "limpar-mural" (Deno)
  migrations/   o SQL do banco
  tests/        testes do SQL (PGlite)
```

---

## Situação

O MindFree está em desenvolvimento e ainda não foi publicado nas lojas. Já funcionam o ritual da noite, as tarefas, o Seu céu, os widgets, as contas e a rede: o Céu dos amigos, o Mural na nuvem e bloquear, denunciar e remover seguidor.

Os próximos passos são:
- avisos (push) de brilho e cutucão;
- login com Google e Apple;
- a publicação no iPhone e no Android.
