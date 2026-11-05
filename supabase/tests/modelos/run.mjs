// Teste cego dos modelos da organização: manda as mesmas noites para cada variante e guarda tarefas, custo e tempo.
// Antes, uma vez, dentro desta pasta: npm install
// Uso:  node run.mjs            (pede a chave da Anthropic sem mostrar na tela; ou usa ANTHROPIC_API_KEY se existir)
//       node run.mjs --dry      (só mostra o que seria mandado, sem chamar a API)
//       node run.mjs --only=sonnet-medio,haiku-medio   (só algumas variantes)
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FUNC = path.join(here, '..', '..', 'functions', 'organizar', 'index.ts');

// O mesmo prompt da função de verdade, lido do arquivo para não sair de sincronia.
const SYSTEM = readFileSync(FUNC, 'utf8').match(/const SYSTEM = `([\s\S]*?)`;/)?.[1];
if (!SYSTEM) throw new Error('não achei o SYSTEM em ' + FUNC);
const SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, note: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' } },
        required: ['title', 'note', 'date', 'time'],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
};

const VARIANTS = [
  { id: 'opus-medio', model: 'claude-opus-5-5', effort: 'medium', fallback: true }, // como está hoje
  { id: 'opus-baixo', model: 'claude-opus-5-5', effort: 'low', fallback: true },
  { id: 'sonnet-medio', model: 'claude-sonnet-5-5', effort: 'medium', fallback: true },
  { id: 'sonnet-baixo', model: 'claude-sonnet-5-5', effort: 'low', fallback: true },
  { id: 'haiku-medio', model: 'claude-haiku-5-5', effort: 'medium', fallback: false }, // Haiku não tem fallback no servidor
];
// US$ por milhão de tokens (entrada, saída), tabela da Anthropic.
const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const variants = only ? VARIANTS.filter((v) => only.includes(v.id)) : VARIANTS;

const { now, nights } = JSON.parse(readFileSync(path.join(here, 'noites.json'), 'utf8'));

function userMessage(night) {
  return [
    `Now: ${now.weekday}, ${now.today} ${now.time} (the person's local time).`,
    `Default day for tasks without a day: ${now.defaultDay}.`,
    `App language: ${night.language}.`,
    '',
    '<brain_dump>',
    night.text,
    '</brain_dump>',
  ].join('\n');
}

function askSecret(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = function (s) {
      if (!muted) readline.Interface.prototype._writeToOutput.call(this, s);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = true;
  });
}

if (dry) {
  console.log('SYSTEM:\n' + SYSTEM + '\n');
  console.log('Variantes:', variants.map((v) => `${v.id} (${v.model}, ${v.effort})`).join(' | '));
  console.log('\nExemplo de mensagem (noite 1):\n' + userMessage(nights[0]));
  console.log(`\n${nights.length} noites × ${variants.length} variantes = ${nights.length * variants.length} chamadas.`);
  process.exit(0);
}

// Tira espaços e caracteres de controle (um Ctrl+V que não virou colagem entra como caractere invisível).
let apiKey = (process.env.ANTHROPIC_API_KEY || (await askSecret('Chave da Anthropic (cole UMA vez, com o botão direito, e dê Enter; nada aparece na tela): ')))
  .replace(/[\x00-\x1f\x7f]/g, '')
  .trim();
// Colagem dupla (Ctrl+V e botão direito): a chave vem repetida; fica só uma.
const half = apiKey.length / 2;
if (Number.isInteger(half) && half >= 20 && apiKey.slice(0, half) === apiKey.slice(half)) {
  apiKey = apiKey.slice(0, half);
  console.log('A chave veio colada duas vezes; usando uma.');
}
if (apiKey.length < 20) {
  console.error(`Recebi só ${apiKey.length} caracteres: a colagem não entrou. Rode de novo e cole com o botão direito do mouse na janela, depois Enter.`);
  process.exit(1);
}
if (!apiKey.startsWith('sk-ant-')) {
  console.warn(`Aviso: recebi ${apiKey.length} caracteres começando com "${apiKey.slice(0, 6)}", não com "sk-ant-". Vou tentar mesmo assim; se a chave for inválida, a API responde 401.`);
} else {
  console.log(`Chave recebida (${apiKey.length} caracteres).`);
}
const client = new Anthropic({ apiKey, maxRetries: 2 });

// Conferência da chave antes das 50 chamadas: uma consulta que não gasta tokens.
try {
  await client.models.retrieve('claude-haiku-5-5');
} catch (error) {
  if (error?.status === 401) {
    console.error(
      `A API recusou a chave (401). Recebi ${apiKey.length} caracteres; a chave completa começa com sk-ant-api03- e costuma ter 108.\n` +
        'Se você copiou da lista de chaves do console, veio mascarada (com ... no meio): crie uma chave nova e copie na hora em que ela aparece.',
    );
  } else {
    console.error('A conferência da chave falhou:', error?.status ?? '', error?.message ?? error);
  }
  process.exit(1);
}
console.log('Chave aceita pela API. Começando as chamadas...');

async function organize(variant, night) {
  const started = Date.now();
  const request = {
    model: variant.model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: variant.effort, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userMessage(night) }],
  };
  if (variant.fallback) {
    request.betas = ['server-side-fallback-2026-07-01'];
    request.fallbacks = 'default';
  }
  try {
    const response = await client.beta.messages.create(request);
    const ms = Date.now() - started;
    const usage = response.usage ?? {};
    const [pin, pout] = PRICES[response.model] ?? PRICES[variant.model];
    const cost = ((usage.input_tokens ?? 0) * pin + (usage.output_tokens ?? 0) * pout) / 1e6;
    if (response.stop_reason === 'refusal') {
      return { night: night.id, variant: variant.id, error: 'refusal', ms, usage, cost, servedBy: response.model };
    }
    const text = response.content.find((b) => b.type === 'text');
    const parsed = text ? JSON.parse(text.text) : { tasks: [] };
    return {
      night: night.id,
      variant: variant.id,
      tasks: parsed.tasks,
      ms,
      usage: { input: usage.input_tokens, output: usage.output_tokens },
      cost,
      servedBy: response.model,
      stop: response.stop_reason,
    };
  } catch (error) {
    return { night: night.id, variant: variant.id, error: `${error?.status ?? ''} ${error?.message ?? error}`.trim(), ms: Date.now() - started };
  }
}

const results = [];
for (const night of nights) {
  process.stdout.write(`noite ${night.id} (${night.name})... `);
  const batch = await Promise.all(variants.map((v) => organize(v, night)));
  results.push(...batch);
  console.log(batch.map((r) => `${r.variant}: ${r.error ? 'ERRO ' + r.error : r.tasks.length + ' tarefas'} (${(r.ms / 1000).toFixed(1)}s)`).join(' | '));
}

writeFileSync(path.join(here, 'resultados.json'), JSON.stringify({ ranAt: new Date().toISOString(), now, results }, null, 2), 'utf8');

console.log('\nvariante      chamadas  erros  custo total  custo/noite  tempo médio  tokens in/out médios');
for (const v of variants) {
  const rows = results.filter((r) => r.variant === v.id);
  const ok = rows.filter((r) => !r.error);
  const cost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const ms = ok.reduce((s, r) => s + r.ms, 0) / Math.max(ok.length, 1);
  const tin = ok.reduce((s, r) => s + (r.usage?.input ?? 0), 0) / Math.max(ok.length, 1);
  const tout = ok.reduce((s, r) => s + (r.usage?.output ?? 0), 0) / Math.max(ok.length, 1);
  console.log(
    `${v.id.padEnd(13)} ${String(rows.length).padStart(8)}  ${String(rows.length - ok.length).padStart(5)}  US$ ${cost.toFixed(4).padStart(7)}  US$ ${(cost / Math.max(rows.length, 1)).toFixed(4)}  ${(ms / 1000).toFixed(1).padStart(6)} s  ${Math.round(tin)}/${Math.round(tout)}`,
  );
}
console.log('\nResultados em ' + path.join(here, 'resultados.json') + '. Agora rode: node avaliar.mjs');
