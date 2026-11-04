import { parseTasks } from '@/lib/parse-tasks';

// Quarta-feira, 4 de novembro de 2026.
const today = new Date(2026, 10, 4);
const titles = (text: string) => parseTasks(text, today).map((task) => task.title);

describe('parseTasks (escrever sem IA)', () => {
  it('separa por linha, vírgula e ponto', () => {
    expect(titles('pagar o boleto\nligar pro dentista, comprar pão. Lavar o carro')).toEqual([
      'Pagar o boleto',
      'Ligar pro dentista',
      'Comprar pão',
      'Lavar o carro',
    ]);
  });

  it('separa em "e" quando o que segue é outra ação', () => {
    expect(titles('ligar pro dentista e comprar presente da Ana')).toEqual(['Ligar pro dentista', 'Comprar presente da Ana']);
    expect(titles('call mom and buy milk')).toEqual(['Call mom', 'Buy milk']);
    expect(titles('tengo que llamar al médico y comprar pan')).toEqual(['Llamar al médico', 'Comprar pan']);
  });

  it('não separa um "e" que liga coisas, não ações', () => {
    expect(titles('arroz e feijão')).toEqual(['Arroz e feijão']);
    expect(titles('Ana e Pedro vêm jantar sábado')).toEqual(['Ana e Pedro vêm jantar']);
  });

  it('tira "preciso", "lembrar de" e amigos, mesmo encadeados', () => {
    expect(titles('preciso lembrar de mandar o email')).toEqual(['Mandar o email']);
    expect(titles('remember to pay rent')).toEqual(['Pay rent']);
    expect(titles('não esquecer de levar o cachorro')).toEqual(['Levar o cachorro']);
  });

  it('entende horários de vários jeitos', () => {
    const minutes = (text: string) => parseTasks(text, today)[0].minutes;
    expect(minutes('dentista às 9')).toBe(9 * 60);
    expect(minutes('reunião 14h30')).toBe(14 * 60 + 30);
    expect(minutes('buscar as crianças 17:30')).toBe(17 * 60 + 30);
    expect(minutes('gym at 7am')).toBe(7 * 60);
    expect(minutes('call at 3pm')).toBe(15 * 60);
    expect(minutes('comprar pão')).toBeNull();
  });

  it('entende hoje, amanhã e os dias da semana (sempre para a frente)', () => {
    const offset = (text: string) => parseTasks(text, today)[0].dayOffset;
    expect(offset('pagar hoje')).toBe(0);
    expect(offset('pagar amanhã')).toBe(1);
    expect(offset('dentista sexta')).toBe(2);
    expect(offset('dentista na quarta')).toBe(7);
    expect(offset('call mom on monday')).toBe(5);
    expect(offset('comprar pão')).toBeNull();
  });

  it('tira o horário e o dia do título e deixa a primeira letra maiúscula', () => {
    expect(parseTasks('ligar pro dentista sexta às 14h', today)[0]).toEqual({ title: 'Ligar pro dentista', minutes: 14 * 60, dayOffset: 2 });
  });

  it('ignora pedaços vazios ou de uma letra', () => {
    expect(titles('a, , b, pagar o boleto')).toEqual(['Pagar o boleto']);
    expect(titles('')).toEqual([]);
  });
});
