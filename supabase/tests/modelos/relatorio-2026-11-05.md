# Teste cego dos modelos (2026-11-05T19:26:18.308Z)

| variante | achou as tarefas | dia certo | hora certa | nº de tarefas ok | tarefa indevida | repetida | problemas | erros | custo/noite | tempo médio |
|---|---|---|---|---|---|---|---|---|---|---|
| opus-medio | 100% (38/38) | 100% | 100% | 10/10 | 0 | 1 | 1 | 0 | US$ 0.0108 | 5.2 s |
| opus-baixo | 100% (38/38) | 100% | 100% | 10/10 | 0 | 0 | 0 | 0 | US$ 0.0073 | 3.9 s |
| sonnet-medio | 100% (38/38) | 100% | 100% | 10/10 | 0 | 0 | 0 | 0 | US$ 0.0044 | 3.5 s |
| sonnet-baixo | 100% (38/38) | 100% | 100% | 10/10 | 0 | 0 | 0 | 0 | US$ 0.0043 | 3.7 s |
| haiku-medio | 100% (38/38) | 100% | 100% | 9/10 | 0 | 0 | 1 | 0 | US$ 0.0004 | 3.4 s |

## Noite 1: simples, com uma preocupação sem ação

> é... deixa eu ver... amanhã eu tenho que ligar pro dentista de manhã, remarcar a limpeza, ah e... pagar o boleto da internet que vence sexta, acho que é sexta, é. hmm... e comprar ração pro gato, tá acabando. tô preocupado com a reunião de segunda mas isso não tem o que fazer agora. é isso, acho.

### opus-medio (4.5 s, US$ 0.0093)
- Ligar pro dentista · 2026-11-06 09:00 · Remarcar a limpeza
- Pagar o boleto da internet · 2026-11-06 · Vence sexta
- Comprar ração pro gato · 2026-11-06 · Tá acabando
  - ✔ tudo certo

### opus-baixo (3.1 s, US$ 0.0062)
- Ligar pro dentista · 2026-11-06 09:00 · Remarcar a limpeza
- Pagar o boleto da internet · 2026-11-06 · Vence sexta
- Comprar ração pro gato · 2026-11-06 · Tá acabando
  - ✔ tudo certo

### sonnet-medio (3.1 s, US$ 0.0031)
- Ligar pro dentista · 2026-11-06 09:00 · Remarcar a limpeza
- Pagar o boleto da internet · 2026-11-06 · Vence sexta
- Comprar ração pro gato · 2026-11-06 · Está acabando
  - ✔ tudo certo

### sonnet-baixo (3.6 s, US$ 0.0031)
- Ligar pro dentista · 2026-11-06 09:00 · Remarcar a limpeza
- Pagar o boleto da internet · 2026-11-06 · Vence sexta
- Comprar ração pro gato · 2026-11-06 · A ração está acabando
  - ✔ tudo certo

### haiku-medio (4.6 s, US$ 0.0005)
- Ligar pro dentista · 2026-11-06 09:00
- Remarcar a limpeza · 2026-11-06 · Combinar com o dentista
- Pagar o boleto da internet · 2026-11-06 · Vence sexta
- Comprar ração pro gato · 2026-11-06 · Tá acabando
  - ⚠ 4 tarefas (esperado 3–3)

## Noite 2: datas relativas: sábado, semana que vem, dia 15, quarta que vem

> ok então... sábado é o aniversário da minha mãe, preciso comprar o presente antes, tipo sexta no máximo. e semana que vem eu tenho que levar o carro pra revisão, qualquer dia, terça talvez. ah, dia 15 vence o IPVA... não, o IPVA não, o seguro do carro, vence dia 15, tenho que pagar. e... ah é, mandar o relatório pro Marcos até quarta que vem, ele pediu com urgência.

### opus-medio (5.8 s, US$ 0.0121)
- Comprar presente de aniversário da mãe · 2026-11-06 · Aniversário dela é no sábado
- Levar o carro pra revisão · 2026-11-10 · Qualquer dia da semana que vem
- Pagar o seguro do carro · 2026-11-15 · Vence dia 15
- Mandar o relatório pro Marcos · 2026-11-11 · Prazo até quarta, ele pediu com urgência
  - ✔ tudo certo

### opus-baixo (3.8 s, US$ 0.0077)
- Comprar presente da minha mãe · 2026-11-06 · Aniversário dela é sábado
- Levar o carro pra revisão · 2026-11-10 · Qualquer dia da semana que vem
- Pagar o seguro do carro · 2026-11-13 · Vence dia 15
- Mandar o relatório pro Marcos · 2026-11-11 · Prazo até quarta, ele pediu com urgência
  - ✔ tudo certo

### sonnet-medio (2.9 s, US$ 0.0040)
- Comprar presente de aniversário da mãe · 2026-11-06 · Aniversário é sábado; comprar até sexta no máximo
- Levar o carro pra revisão · 2026-11-10 · Semana que vem, qualquer dia, terça talvez
- Pagar o seguro do carro · 2026-11-13 · Vence dia 15
- Mandar o relatório pro Marcos · 2026-11-11 · Ele pediu com urgência, prazo quarta que vem
  - ✔ tudo certo

### sonnet-baixo (3.4 s, US$ 0.0041)
- Comprar presente de aniversário da mãe · 2026-11-06 · Aniversário é sábado, comprar até sexta no máximo
- Levar o carro para a revisão · 2026-11-10 · Qualquer dia na semana que vem, terça talvez
- Pagar o seguro do carro · 2026-11-13 · Vence dia 15
- Mandar o relatório pro Marcos · 2026-11-11 · Prazo até quarta que vem, ele pediu com urgência
  - ✔ tudo certo

### haiku-medio (3.9 s, US$ 0.0004)
- Comprar o presente de aniversário da mãe · 2026-11-06 · O aniversário dela é no sábado; comprar até sexta no máximo
- Levar o carro para revisão · 2026-11-10 · Pode ser terça, se der
- Pagar o seguro do carro · 2026-11-15 · Vence dia 15
- Enviar o relatório para o Marcos · 2026-11-11 · Ele pediu com urgência; prazo até quarta que vem
  - ✔ tudo certo

## Noite 3: só desabafo, nada a fazer

> nossa, que dia... eu fico pensando se eu falei besteira na reunião, sei lá, o Paulo ficou com uma cara... e tô cansado, muito cansado, acho que não tô dormindo direito. enfim. espero que amanhã seja melhor. é isso.

### opus-medio (2.0 s, US$ 0.0035)
- (nenhuma tarefa)
  - ✔ tudo certo

### opus-baixo (1.9 s, US$ 0.0035)
- (nenhuma tarefa)
  - ✔ tudo certo

### sonnet-medio (1.3 s, US$ 0.0018)
- (nenhuma tarefa)
  - ✔ tudo certo

### sonnet-baixo (2.3 s, US$ 0.0018)
- (nenhuma tarefa)
  - ✔ tudo certo

### haiku-medio (1.2 s, US$ 0.0001)
- (nenhuma tarefa)
  - ✔ tudo certo

## Noite 4: longa, com horários, item repetido e compras

> tá, lista. amanhã de manhã às 8 eu tenho que estar no laboratório pro exame de sangue, em jejum, não esquecer. depois do exame passar no mercado: leite, pão, café, e... detergente. à tarde, tipo umas 3, ligar pra Dra. Helena pra marcar o retorno. ah, e o exame de sangue, 8 horas, jejum, já falei. hmm... o João pediu pra eu mandar as fotos do churrasco, mando amanhã. ah e o aluguel! transferir o aluguel pro proprietário, vence dia 10. e terminar a apresentação do trabalho até quinta que vem, é a de vendas. acho que é isso... ah não, pegar a roupa na lavanderia, tá lá desde terça.

### opus-medio (7.8 s, US$ 0.0193)
- Fazer exame de sangue no laboratório · 2026-11-06 08:00 · Ir em jejum
- Passar no mercado · 2026-11-06 · Leite, pão, café e detergente (depois do exame)
- Ligar pra Dra. Helena · 2026-11-06 15:00 · Marcar o retorno
- Mandar as fotos do churrasco pro João · 2026-11-06
- Transferir o aluguel pro proprietário · 2026-11-06 · Vence dia 10
- Terminar a apresentação de vendas · 2026-11-12 · Prazo: quinta que vem (12/11)
- Pegar a roupa na lavanderia · 2026-11-06 · Está lá desde terça
  - ⚠ repetida 2x: "sangue|exame|laborat"

### opus-baixo (4.6 s, US$ 0.0106)
- Fazer exame de sangue no laboratório · 2026-11-06 08:00 · Ir em jejum
- Passar no mercado · 2026-11-06 · Leite, pão, café e detergente
- Ligar pra Dra. Helena · 2026-11-06 15:00 · Marcar o retorno
- Mandar as fotos do churrasco pro João · 2026-11-06
- Transferir o aluguel pro proprietário · 2026-11-06 · Vence dia 10
- Terminar a apresentação de vendas · 2026-11-12 · Prazo: quinta que vem
- Pegar a roupa na lavanderia · 2026-11-06 · Está lá desde terça
  - ✔ tudo certo

### sonnet-medio (3.3 s, US$ 0.0055)
- Fazer exame de sangue no laboratório · 2026-11-06 08:00 · Em jejum, não esquecer
- Passar no mercado · 2026-11-06 · Comprar leite, pão, café e detergente
- Ligar pra Dra. Helena · 2026-11-06 15:00 · Marcar o retorno
- Mandar as fotos do churrasco pro João · 2026-11-06 · Ele pediu as fotos
- Transferir o aluguel pro proprietário · 2026-11-06 · Vence dia 10
- Terminar a apresentação de vendas · 2026-11-06 · Prazo: quinta que vem (12/11)
- Pegar a roupa na lavanderia · 2026-11-06 · Está lá desde terça
  - ✔ tudo certo

### sonnet-baixo (3.7 s, US$ 0.0055)
- Fazer exame de sangue no laboratório · 2026-11-06 08:00 · Em jejum, não esquecer
- Passar no mercado · 2026-11-06 · Leite, pão, café e detergente
- Ligar pra Dra. Helena · 2026-11-06 15:00 · Marcar o retorno
- Mandar as fotos do churrasco pro João · 2026-11-06 · Ele pediu as fotos
- Transferir o aluguel pro proprietário · 2026-11-06 · Vence dia 10
- Terminar a apresentação de vendas · 2026-11-12 · Prazo: quinta que vem (2026-11-12)
- Pegar a roupa na lavanderia · 2026-11-06 · Está lá desde terça
  - ✔ tudo certo

### haiku-medio (4.1 s, US$ 0.0006)
- Fazer exame de sangue no laboratório · 2026-11-06 08:00 · Em jejum
- Passar no mercado · 2026-11-06 · Leite, pão, café e detergente
- Ligar para a Dra. Helena · 2026-11-06 15:00 · Marcar o retorno
- Mandar as fotos do churrasco para o João · 2026-11-06 · Pedido do João
- Transferir o aluguel para o proprietário · 2026-11-10 · Vence dia 10
- Terminar a apresentação do trabalho de vendas · 2026-11-12 · Entregar até quinta que vem
- Pegar a roupa na lavanderia · 2026-11-06 · Está lá desde terça
  - ✔ tudo certo

## Noite 5: erros de transcrição, gíria, feriado do dia 20

> então né, o Carlo me ligou... Carlos, e falou do churras no sábado, tenho que confirmar com ele e levar a carne, uns dois quilo de picanha. hmm, e depois do feriado do dia 20 eu vou ter que renovar a carteira de motorista, vence em dezembro, então segunda depois do feriado. ah, e o remédio da pressão da minha vó, buscar na farmácia amanhã, a receita tá na gaveta. tô devendo ligar pra tia Lu, faz tempo, qualquer dia desses. e... ah, o pneu, calibrar o pneu, tá murcho.

### opus-medio (10.5 s, US$ 0.0190)
- Confirmar o churrasco com o Carlos · 2026-11-06 · Churrasco no sábado
- Levar 2 kg de picanha pro churrasco · 2026-11-07 · Churrasco do Carlos
- Renovar a carteira de motorista · 2026-11-23 · Vence em dezembro
- Buscar o remédio de pressão da vó na farmácia · 2026-11-06 · A receita tá na gaveta
- Ligar pra tia Lu · 2026-11-06 · Faz tempo que não liga
- Calibrar o pneu · 2026-11-06 · Tá murcho
  - ✔ tudo certo

### opus-baixo (6.8 s, US$ 0.0094)
- Confirmar churrasco com o Carlos · 2026-11-06 · Churrasco no sábado
- Comprar 2 kg de picanha · 2026-11-07 · Levar para o churrasco do Carlos no sábado
- Renovar a carteira de motorista · 2026-11-23 · Vence em dezembro
- Buscar remédio da pressão da vó na farmácia · 2026-11-06 · A receita está na gaveta
- Ligar para a tia Lu · 2026-11-06
- Calibrar o pneu · 2026-11-06 · Está murcho
  - ✔ tudo certo

### sonnet-medio (5.2 s, US$ 0.0087)
- Confirmar o churrasco com o Carlos · 2026-11-06 · Churrasco é no sábado
- Levar a picanha pro churrasco · 2026-11-07 · Uns 2 kg de picanha
- Renovar a carteira de motorista · 2026-11-23 · Vence em dezembro
- Buscar o remédio de pressão da vó na farmácia · 2026-11-06 · A receita está na gaveta
- Ligar pra tia Lu · 2026-11-06 · Faz tempo que não falam
- Calibrar o pneu · 2026-11-06 · Está murcho
  - ✔ tudo certo

### sonnet-baixo (5.3 s, US$ 0.0085)
- Confirmar churrasco com o Carlos · 2026-11-06 · Churrasco é no sábado
- Levar picanha pro churrasco · 2026-11-07 · Cerca de 2 kg de picanha
- Buscar remédio de pressão da vó na farmácia · 2026-11-06 · A receita está na gaveta
- Ligar pra tia Lu · 2026-11-06 · Faz tempo que não fala com ela
- Calibrar o pneu · 2026-11-06 · Está murcho
- Renovar a carteira de motorista · 2026-11-23 · Vence em dezembro
  - ✔ tudo certo

### haiku-medio (3.5 s, US$ 0.0004)
- Confirmar churrasco com o Carlos · 2026-11-07 · Levar a carne: uns dois quilos de picanha
- Renovar a carteira de motorista · 2026-11-23 · Vence em dezembro
- Buscar o remédio da pressão da vó na farmácia · 2026-11-06 · A receita está na gaveta
- Ligar pra tia Lu · 2026-11-06 · Faz tempo que não falo com ela
- Calibrar o pneu · 2026-11-06 · Pneu está murcho
  - ✔ tudo certo

## Noite 6: horários: 10 e meia, depois do almoço, fim da tarde, 8 da noite

> amanhã... reunião com a contadora às 10 e meia, levar os extratos. depois do almoço passar no correio pra mandar a encomenda da Bia. no fim da tarde, buscar as crianças na escola, a Ana não vai poder. e... de noite, umas 8, ligar pra minha irmã que é aniversário dela. ah, e sexta que vem levar o cachorro no veterinário, vacina, de manhã cedo.

### opus-medio (6.3 s, US$ 0.0118)
- Reunião com a contadora · 2026-11-06 10:30 · Levar os extratos
- Passar no correio para mandar a encomenda da Bia · 2026-11-06 13:00
- Buscar as crianças na escola · 2026-11-06 17:00 · A Ana não vai poder
- Ligar para a irmã · 2026-11-06 20:00 · Aniversário dela
- Levar o cachorro ao veterinário · 2026-11-13 08:00 · Vacina
  - ✔ tudo certo

### opus-baixo (5.2 s, US$ 0.0083)
- Reunião com a contadora · 2026-11-06 10:30 · Levar os extratos
- Passar no correio para mandar a encomenda da Bia · 2026-11-06 13:00
- Buscar as crianças na escola · 2026-11-06 17:00 · A Ana não vai poder
- Ligar para a irmã · 2026-11-06 20:00 · Aniversário dela
- Levar o cachorro no veterinário · 2026-11-13 08:00 · Vacina
  - ✔ tudo certo

### sonnet-medio (8.0 s, US$ 0.0074)
- Reunião com a contadora · 2026-11-06 10:30 · Levar os extratos
- Passar no correio · 2026-11-06 13:00 · Mandar a encomenda da Bia
- Buscar as crianças na escola · 2026-11-06 17:00 · A Ana não vai poder
- Ligar pra minha irmã · 2026-11-06 20:00 · É aniversário dela
- Levar o cachorro no veterinário · 2026-11-13 07:00 · Vacina, de manhã cedo
  - ✔ tudo certo

### sonnet-baixo (7.2 s, US$ 0.0065)
- Reunião com a contadora · 2026-11-06 10:30 · Levar os extratos
- Passar no correio para enviar a encomenda da Bia · 2026-11-06 13:00
- Buscar as crianças na escola · 2026-11-06 17:30 · A Ana não vai poder buscar
- Ligar para minha irmã · 2026-11-06 20:00 · É aniversário dela
- Levar o cachorro no veterinário · 2026-11-13 08:00 · Vacina
  - ✔ tudo certo

### haiku-medio (4.6 s, US$ 0.0005)
- Reunião com a contadora · 2026-11-06 10:30 · Levar os extratos
- Passar no correio para mandar a encomenda da Bia · 2026-11-06 13:00
- Buscar as crianças na escola · 2026-11-06 · A Ana não vai poder
- Ligar para a minha irmã · 2026-11-06 20:00 · É aniversário dela
- Levar o cachorro ao veterinário para vacina · 2026-11-13 · De manhã cedo
  - ✔ tudo certo

## Noite 7: inglês, com prazo e preocupação

> okay so, um, tomorrow I need to, uh, send the invoice to the client, the design one, before noon ideally. and I should book the flight for Chicago, the conference is on the 18th, so book it this week. uh, call mom back, she called twice. and, um, gym, I keep saying that, let's say Saturday morning. oh and renew the domain, it expires on the 12th, don't forget. that's it I think, I'm worried about the budget review but whatever.

### opus-medio (3.3 s, US$ 0.0076)
- Send invoice to design client · 2026-11-06 · Before noon ideally
- Book flight to Chicago · 2026-11-06 · Conference is on the 18th; book this week
- Call mom back · 2026-11-06 · She called twice
- Go to the gym · 2026-11-07 · Saturday morning
- Renew the domain · 2026-11-06 · Expires on the 12th
  - ✔ tudo certo

### opus-baixo (3.3 s, US$ 0.0076)
- Send invoice to design client · 2026-11-06 · Before noon ideally
- Book flight to Chicago · 2026-11-06 · Conference is on the 18th; book this week
- Call mom back · 2026-11-06 · She called twice
- Go to the gym · 2026-11-07 09:00 · Saturday morning
- Renew the domain · 2026-11-06 · Expires on the 12th
  - ✔ tudo certo

### sonnet-medio (3.1 s, US$ 0.0038)
- Send the design invoice to the client · 2026-11-06 11:00 · Ideally before noon
- Book flight to Chicago · 2026-11-06 · Conference is on the 18th; book this week
- Call mom back · 2026-11-06 · She called twice
- Go to the gym · 2026-11-07 09:00
- Renew the domain · 2026-11-06 · Expires on the 12th
  - ✔ tudo certo

### sonnet-baixo (2.4 s, US$ 0.0038)
- Send invoice to the design client · 2026-11-06 11:00 · Ideally before noon
- Book flight to Chicago · 2026-11-06 · Conference is on the 18th; book this week
- Call mom back · 2026-11-06 · She called twice
- Go to the gym · 2026-11-07 09:00
- Renew the domain · 2026-11-06 · Expires on the 12th
  - ✔ tudo certo

### haiku-medio (4.1 s, US$ 0.0004)
- Send the design invoice to the client · 2026-11-06 · Before noon ideally
- Book the flight to Chicago · 2026-11-06 · Conference is on the 18th
- Call mom back · 2026-11-06 · She called twice
- Go to the gym · 2026-11-07
- Renew the domain · 2026-11-06 · Expires on the 12th
  - ✔ tudo certo

## Noite 8: espanhol, com horários e domingo

> a ver... mañana tengo que ir al banco a las nueve para firmar lo del préstamo, llevar el documento. y comprar las entradas del concierto, salen a la venta el lunes a las diez de la mañana, hay que estar atento. eh... llamar al plomero por la fuga de la cocina, eso urgente, mañana mismo. y el domingo comida en casa de mis padres, llevar el postre. estoy un poco agobiado con el trabajo pero bueno.

### opus-medio (3.4 s, US$ 0.0076)
- Ir al banco a firmar el préstamo · 2026-11-06 09:00 · Llevar el documento
- Comprar las entradas del concierto · 2026-11-09 10:00 · Salen a la venta a las 10, estar atento
- Llamar al plomero · 2026-11-06 · Urgente: fuga de la cocina
- Comida en casa de mis padres · 2026-11-08 · Llevar el postre
  - ✔ tudo certo

### opus-baixo (6.7 s, US$ 0.0078)
- Ir al banco a firmar el préstamo · 2026-11-06 09:00 · Llevar el documento
- Llamar al plomero · 2026-11-06 · Urgente: fuga de la cocina
- Llevar el postre a la comida en casa de mis padres · 2026-11-08 · Comida del domingo
- Comprar las entradas del concierto · 2026-11-09 10:00 · Salen a la venta a las 10:00, estar atento
  - ✔ tudo certo

### sonnet-medio (2.2 s, US$ 0.0038)
- Ir al banco a firmar el préstamo · 2026-11-06 09:00 · Llevar el documento
- Llamar al plomero · 2026-11-06 · Fuga en la cocina, urgente
- Comprar las entradas del concierto · 2026-11-09 10:00 · Salen a la venta a las 10:00, estar atento
- Comida en casa de mis padres · 2026-11-08 · Llevar el postre
  - ✔ tudo certo

### sonnet-baixo (2.2 s, US$ 0.0039)
- Ir al banco a firmar el préstamo · 2026-11-06 09:00 · Llevar el documento
- Llamar al plomero por la fuga de la cocina · 2026-11-06 · Urgente
- Comprar las entradas del concierto · 2026-11-09 10:00 · Salen a la venta el lunes a las 10:00, estar atento
- Comida en casa de mis padres · 2026-11-08 · Llevar el postre
  - ✔ tudo certo

### haiku-medio (3.0 s, US$ 0.0004)
- Ir al banco a firmar el préstamo · 2026-11-06 09:00 · Llevar el documento
- Comprar las entradas del concierto · 2026-11-09 10:00 · Salen a la venta a las 10 de la mañana, estar atento
- Llamar al plomero · 2026-11-06 · Urgente, por la fuga de la cocina
- Llevar el postre a casa de mis padres · 2026-11-08 · Comida del domingo en casa de mis padres
  - ✔ tudo certo

## Noite 9: curtíssima, uma coisa só

> hã... é... só lembrar de... de levar o guarda-chuva amanhã que vai chover. e... é isso. boa noite.

### opus-medio (3.8 s, US$ 0.0041)
- Levar o guarda-chuva · 2026-11-06 · Vai chover
  - ✔ tudo certo

### opus-baixo (1.5 s, US$ 0.0041)
- Levar o guarda-chuva · 2026-11-06 · Vai chover
  - ✔ tudo certo

### sonnet-medio (4.4 s, US$ 0.0021)
- Levar o guarda-chuva · 2026-11-06 · Vai chover amanhã
  - ✔ tudo certo

### sonnet-baixo (4.3 s, US$ 0.0021)
- Levar o guarda-chuva · 2026-11-06 · Vai chover amanhã
  - ✔ tudo certo

### haiku-medio (1.4 s, US$ 0.0001)
- Levar o guarda-chuva · 2026-11-06 · Vai chover
  - ✔ tudo certo

## Noite 10: correção no meio da fala, repetição e todo dia

> tá... daqui a duas semanas é a entrega do projeto, então na segunda que vem eu preciso sentar com o time e dividir as tarefas, de manhã. no fim do mês tenho que declarar o imposto da empresa, o simples, antes do dia 30... acho que é dia 20 na verdade, o simples vence dia 20, então dia 20. hmm, começar a caminhar todo dia, pelo menos amanhã. ah, e já falei do time? sentar com o time segunda. e trocar a lâmpada do corredor, queimou de novo, comprar lâmpada e trocar.

### opus-medio (4.9 s, US$ 0.0132)
- Sentar com o time e dividir as tarefas do projeto · 2026-11-09 09:00 · Entrega do projeto daqui a duas semanas
- Declarar o imposto da empresa (Simples) · 2026-11-20 · O Simples vence dia 20
- Fazer uma caminhada · 2026-11-06 · Meta: começar a caminhar todo dia
- Comprar e trocar a lâmpada do corredor · 2026-11-06 · Queimou de novo
  - ✔ tudo certo

### opus-baixo (2.3 s, US$ 0.0078)
- Reunião com o time para dividir as tarefas do projeto · 2026-11-09 · Entrega do projeto daqui a duas semanas
- Pagar o Simples da empresa · 2026-11-20 · Vence dia 20
- Caminhar · 2026-11-06 · Começar a caminhar todo dia
- Comprar lâmpada e trocar a do corredor · 2026-11-06 · Queimou de novo
  - ✔ tudo certo

### sonnet-medio (2.0 s, US$ 0.0041)
- Reunir com o time para dividir as tarefas do projeto · 2026-11-09 09:00 · A entrega do projeto é daqui a duas semanas
- Declarar o imposto da empresa (Simples) · 2026-11-20 · O Simples vence dia 20
- Começar a caminhar · 2026-11-06 · Caminhar todo dia, começando amanhã
- Comprar lâmpada e trocar a do corredor · 2026-11-06 · Queimou de novo
  - ✔ tudo certo

### sonnet-baixo (2.2 s, US$ 0.0041)
- Reunir o time e dividir as tarefas do projeto · 2026-11-09 09:00 · A entrega do projeto é daqui a duas semanas
- Declarar o imposto da empresa (Simples) · 2026-11-20 · O Simples vence dia 20
- Começar a caminhar · 2026-11-06 · Meta de caminhar todo dia, começando amanhã
- Comprar lâmpada e trocar a do corredor · 2026-11-06 · Queimou de novo
  - ✔ tudo certo

### haiku-medio (3.6 s, US$ 0.0004)
- Sentar com o time e dividir as tarefas do projeto · 2026-11-09 · A entrega do projeto é daqui a duas semanas
- Declarar o imposto da empresa (Simples) · 2026-11-20 · Vence dia 20
- Começar a caminhar todo dia · 2026-11-06 · Começar amanhã
- Comprar e trocar a lâmpada do corredor · 2026-11-06 · A lâmpada queimou de novo
  - ✔ tudo certo

