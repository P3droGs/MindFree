// Gera as páginas públicas da política de privacidade e dos termos de uso (GitHub Pages) a partir de
// src/legal/privacy.ts e src/legal/terms.ts, para o texto do app e o da web serem sempre o mesmo.
// Uso: node scripts/privacy-page.mjs
// Saída: docs/privacidade/index.html, docs/termos/index.html (português e inglês) e docs/index.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = new URL('../', import.meta.url);

// Os arquivos do app importam um tipo do i18n e os termos importam a política; fora do app, basta tirar
// a linha do tipo, apontar a importação para o arquivo transpilado ao lado e carregar os dois.
const cache = new URL('node_modules/.cache/legal/', root);
mkdirSync(cache, { recursive: true });
for (const name of ['privacy', 'terms']) {
  const source = readFileSync(new URL(`src/legal/${name}.ts`, root), 'utf8')
    .replace(/^import type .*$/m, '')
    .replace("from '@/legal/privacy'", "from './privacy.mjs'");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  writeFileSync(new URL(`${name}.mjs`, cache), js);
}
const { privacyPolicyFor } = await import(new URL('privacy.mjs', cache).href);
const { termsFor } = await import(new URL('terms.mjs', cache).href);
const pt = privacyPolicyFor('pt-BR').policy;
const en = privacyPolicyFor('en').policy;
const termsPt = termsFor('pt-BR').terms;
const termsEn = termsFor('en').terms;

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
// "• item\n• item" vira uma lista; o resto é parágrafo.
const paragraph = (text) =>
  text.startsWith('•')
    ? `<ul>${text.split('\n').map((line) => `<li>${escape(line.replace(/^•\s*/, ''))}</li>`).join('')}</ul>`
    : `<p>${escape(text)}</p>`;
const policy = (p, lang, heading) => `
  <section lang="${lang}" id="${lang === 'pt-BR' ? 'pt' : 'en'}">
    <h2>${heading}</h2>
    <p class="meta">${escape(p.updated)}</p>
    <p class="draft">${escape(p.draft)}</p>
    ${p.sections.map((s) => `<h3>${escape(s.title)}</h3>${s.paragraphs.map(paragraph).join('')}`).join('\n')}
  </section>`;

const sparkle = (x, y, r) => {
  const k = 0.16, j = 0.38;
  return `M ${x} ${y - r} C ${x + r * k} ${y - r * j}, ${x + r * j} ${y - r * k}, ${x + r} ${y} C ${x + r * j} ${y + r * k}, ${x + r * k} ${y + r * j}, ${x} ${y + r} C ${x - r * k} ${y + r * j}, ${x - r * j} ${y + r * k}, ${x - r} ${y} C ${x - r * j} ${y - r * k}, ${x - r * k} ${y - r * j}, ${x} ${y - r} Z`;
};
const logo = `<svg width="28" height="28" viewBox="170 198 727 610" aria-hidden="true"><circle cx="226" cy="584" r="46" fill="#D9CFFF"/><line x1="280" y1="630" x2="334" y2="680" stroke="#D9CFFF" stroke-width="40" stroke-linecap="round"/><circle cx="394" cy="740" r="58" fill="#D9CFFF"/><line x1="452" y1="676" x2="648" y2="454" stroke="#D9CFFF" stroke-width="40" stroke-linecap="round"/><path d="${sparkle(712, 383, 175)}" fill="#FFC857"/></svg>`;

const page = (title, lang, body, nested = false) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="${nested ? '../' : ''}favicon.png">
<style>
  /* As cores e o acabamento do site (mindfree.com.br): a noite do app, o lilás, a estrela dourada e os fios finos. */
  :root { --fundo: #10142E; --fundo-fundo: #0B0E24; --cartao: #1A1F45; --fio: #262C5A; --fio-forte: #6C73AC; --texto: #EEF0FF; --suave: #B4B9DD; --destaque: #B9A6FF; --ouro: #FFC857; color-scheme: dark; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; scroll-padding-top: 5.5rem; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 600 1.0625rem/1.6 'Nunito', ui-rounded, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  .topo { position: sticky; top: 0; z-index: 1; background: var(--fundo-fundo); border-bottom: 1px solid var(--fio); }
  .topo div { display: flex; align-items: center; gap: 0.6rem; max-width: 46rem; min-height: 4.5rem; margin: 0 auto; padding: 0 max(1.25rem, env(safe-area-inset-right)) 0 max(1.25rem, env(safe-area-inset-left)); }
  .mark { display: flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 10px; background: var(--fundo); box-shadow: inset 0 0 0 1px rgba(185, 166, 255, 0.35); }
  .topo strong { font-size: 1.3125rem; font-weight: 800; letter-spacing: -0.01em; }
  .wrap { max-width: 46rem; margin: 0 auto; padding: clamp(2rem, 1.5rem + 3vw, 4rem) max(1.25rem, env(safe-area-inset-right)) 4rem max(1.25rem, env(safe-area-inset-left)); }
  h1 { margin: 0 0 1.25rem; font-size: clamp(2rem, 1.4rem + 2.6vw, 3rem); font-weight: 800; line-height: 1.08; letter-spacing: -0.02em; text-wrap: balance; }
  nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  nav a { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0 1.1rem; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--fio-forte); font-weight: 800; text-decoration: none; }
  nav a:hover { background: var(--cartao); }
  section { margin-top: 2.5rem; padding-top: 2.5rem; border-top: 1px solid var(--fio); }
  h2 { margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; }
  h3 { margin: 2.25rem 0 0.5rem; color: var(--destaque); font-size: 1.25rem; font-weight: 800; line-height: 1.3; }
  p, li { max-width: 65ch; color: var(--suave); }
  p { margin: 0 0 0.9rem; text-wrap: pretty; }
  ul { margin: 0 0 0.9rem; padding-left: 1.25rem; }
  li { margin-bottom: 0.35rem; }
  li::marker { color: var(--destaque); }
  .meta { margin: 0; font-size: 0.9375rem; }
  .draft { margin: 1rem 0 0; padding: 0.85rem 1rem; border-radius: 14px; background: #2A2340; box-shadow: inset 0 0 0 1px #5B4A2A; color: var(--ouro); font-weight: 800; }
  a { color: var(--texto); text-decoration-color: var(--fio-forte); text-decoration-thickness: 1.5px; text-underline-offset: 0.22em; }
  a:hover { text-decoration-color: currentColor; }
  :focus-visible { outline: 3px solid var(--destaque); outline-offset: 3px; border-radius: 8px; }
  footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid var(--fio); color: var(--suave); font-size: 0.9375rem; }
</style>
</head>
<body>
<header class="topo"><div><span class="mark">${logo}</span><strong>MindFree</strong></div></header>
<div class="wrap">
  ${body}
  <footer>MindFree · <a href="https://github.com/P3droGs/MindFree">github.com/P3droGs/MindFree</a></footer>
</div>
</body>
</html>
`;

const privacy = page(
  'Política de privacidade · MindFree',
  'pt-BR',
  `<h1>Política de privacidade</h1>
  <nav aria-label="Idioma"><a href="#pt">Português</a><a href="#en" hreflang="en">English</a></nav>
  ${policy(pt, 'pt-BR', 'Português')}
  ${policy(en, 'en', 'English')}`,
  true,
);
const terms = page(
  'Termos de uso · MindFree',
  'pt-BR',
  `<h1>Termos de uso</h1>
  <nav aria-label="Idioma"><a href="#pt">Português</a><a href="#en" hreflang="en">English</a></nav>
  ${policy(termsPt, 'pt-BR', 'Português')}
  ${policy(termsEn, 'en', 'English')}`,
  true,
);
const home = page(
  'MindFree',
  'pt-BR',
  `<h1>Antes de dormir, fale o que está na sua cabeça. De manhã, está tudo organizado.</h1>
  <p>O MindFree é um app para iPhone e Android que transforma o que você fala à noite em tarefas com dia, horário e lembrete.</p>
  <p><a href="privacidade/">Política de privacidade</a> · <a href="termos/">Termos de uso</a></p>
  <p lang="en"><a href="privacidade/#en" hreflang="en">Privacy policy</a> · <a href="termos/#en" hreflang="en">Terms of use</a></p>`,
);

mkdirSync(new URL('docs/privacidade/', root), { recursive: true });
writeFileSync(new URL('docs/privacidade/index.html', root), privacy);
mkdirSync(new URL('docs/termos/', root), { recursive: true });
writeFileSync(new URL('docs/termos/index.html', root), terms);
writeFileSync(new URL('docs/index.html', root), home);
writeFileSync(new URL('docs/.nojekyll', root), '');
writeFileSync(new URL('docs/favicon.png', root), readFileSync(new URL('assets/images/favicon.png', root)));
console.log('gerado: docs/index.html, docs/privacidade/index.html e docs/termos/index.html');
