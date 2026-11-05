// Corrige o teste cego: compara as tarefas de cada variante com o gabarito de noites.json e escreve relatorio.md.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { nights } = JSON.parse(readFileSync(path.join(here, 'noites.json'), 'utf8'));
const { results, ranAt } = JSON.parse(readFileSync(path.join(here, 'resultados.json'), 'utf8'));
const variants = [...new Set(results.map((r) => r.variant))];

const text = (t) => `${t.title} ${t.note}`.toLowerCase();
const re = (p) => new RegExp(p, 'i');

function grade(night, tasks) {
  const g = { items: 0, found: 0, dates: 0, datesOk: 0, times: 0, timesOk: 0, forbidden: 0, dup: 0, countOk: 0, problems: [] };
  g.countOk = tasks.length >= night.count[0] && tasks.length <= night.count[1] ? 1 : 0;
  if (!g.countOk) g.problems.push(`${tasks.length} tarefas (esperado ${night.count[0]}–${night.count[1]})`);
  for (const item of night.items) {
    g.items++;
    const matches = tasks.filter((t) => re(item.match).test(text(t)));
    const task = matches.find((t) => item.dates.includes(t.date)) ?? matches[0];
    if (!task) {
      g.problems.push(`faltou: ${item.name}`);
      continue;
    }
    g.found++;
    g.dates++;
    if (item.dates.includes(task.date)) g.datesOk++;
    else g.problems.push(`${item.name}: dia ${task.date} (esperado ${item.dates.join('/')})`);
    if (item.times) {
      g.times++;
      if (item.times.includes(task.time)) g.timesOk++;
      else g.problems.push(`${item.name}: hora "${task.time}" (esperado ${item.times.map((x) => x || 'vazio').join('/')})`);
    }
  }
  for (const f of night.forbidden ?? []) {
    if (tasks.some((t) => re(f).test(text(t)))) {
      g.forbidden++;
      g.problems.push(`virou tarefa sem dever: "${f}"`);
    }
  }
  for (const s of night.single ?? []) {
    const n = tasks.filter((t) => re(s).test(text(t))).length;
    if (n > 1) {
      g.dup++;
      g.problems.push(`repetida ${n}x: "${s}"`);
    }
  }
  for (const t of tasks) {
    if (t.date < '2026-11-05') g.problems.push(`dia no passado: ${t.title} ${t.date}`);
    if (t.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) g.problems.push(`hora inválida: ${t.title} "${t.time}"`);
  }
  return g;
}

const totals = Object.fromEntries(variants.map((v) => [v, { items: 0, found: 0, dates: 0, datesOk: 0, times: 0, timesOk: 0, forbidden: 0, dup: 0, countOk: 0, nights: 0, errors: 0, cost: 0, ms: 0, problems: 0 }]));
const perNight = [];
for (const night of nights) {
  const row = { night, byVariant: {} };
  for (const v of variants) {
    const r = results.find((x) => x.night === night.id && x.variant === v);
    const T = totals[v];
    if (!r || r.error) {
      T.errors++;
      row.byVariant[v] = { error: r?.error ?? 'sem resultado' };
      continue;
    }
    const g = grade(night, r.tasks);
    row.byVariant[v] = { tasks: r.tasks, grade: g, ms: r.ms, cost: r.cost, servedBy: r.servedBy };
    T.nights++;
    T.cost += r.cost ?? 0;
    T.ms += r.ms;
    for (const k of ['items', 'found', 'dates', 'datesOk', 'times', 'timesOk', 'forbidden', 'dup', 'countOk']) T[k] += g[k];
    T.problems += g.problems.length;
  }
  perNight.push(row);
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
let md = `# Teste cego dos modelos (${ranAt})\n\n`;
md += '| variante | achou as tarefas | dia certo | hora certa | nº de tarefas ok | tarefa indevida | repetida | problemas | erros | custo/noite | tempo médio |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const v of variants) {
  const T = totals[v];
  md += `| ${v} | ${pct(T.found, T.items)} (${T.found}/${T.items}) | ${pct(T.datesOk, T.dates)} | ${pct(T.timesOk, T.times)} | ${T.countOk}/${T.nights} | ${T.forbidden} | ${T.dup} | ${T.problems} | ${T.errors} | US$ ${(T.cost / Math.max(T.nights, 1)).toFixed(4)} | ${(T.ms / Math.max(T.nights, 1) / 1000).toFixed(1)} s |\n`;
}
md += '\n';
for (const row of perNight) {
  md += `## Noite ${row.night.id}: ${row.night.name}\n\n> ${row.night.text}\n\n`;
  for (const v of variants) {
    const r = row.byVariant[v];
    if (r.error) {
      md += `### ${v}: ERRO ${r.error}\n\n`;
      continue;
    }
    md += `### ${v} (${(r.ms / 1000).toFixed(1)} s, US$ ${r.cost.toFixed(4)}${r.servedBy && !v.startsWith(r.servedBy.split('-')[1]) ? `, atendido por ${r.servedBy}` : ''})\n`;
    md += r.tasks.length ? r.tasks.map((t) => `- ${t.title} · ${t.date}${t.time ? ' ' + t.time : ''}${t.note ? ' · ' + t.note : ''}`).join('\n') + '\n' : '- (nenhuma tarefa)\n';
    md += r.grade.problems.length ? `  - ⚠ ${r.grade.problems.join(' · ')}\n` : '  - ✔ tudo certo\n';
    md += '\n';
  }
}
writeFileSync(path.join(here, 'relatorio.md'), md, 'utf8');
console.log(md.split('\n').slice(0, 4 + variants.length).join('\n'));
console.log('\nRelatório completo em ' + path.join(here, 'relatorio.md'));
