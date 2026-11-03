// Gera a página pública da política de privacidade (GitHub Pages) a partir de src/legal/privacy.ts,
// para o texto do app e o da web serem sempre o mesmo. Uso: node scripts/privacy-page.mjs
// Saída: docs/privacidade/index.html (português e inglês) e docs/index.html (a porta de entrada).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = new URL('../', import.meta.url);

// O arquivo do app importa só um tipo; fora do app, basta tirar a linha e transpilar.
const source = readFileSync(new URL('src/legal/privacy.ts', root), 'utf8').replace(/^import type .*$/m, '');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { privacyPolicyFor } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const pt = privacyPolicyFor('pt-BR').policy;
const en = privacyPolicyFor('en').policy;

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

const page = (title, lang, body) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="${lang === 'pt-BR' && title.includes('privacidade') ? '../' : ''}favicon.png">
<style>
  :root { --night: #0B0E24; --card: #141A42; --line: #262D63; --text: #EEF0FF; --soft: #B4B9DD; --lilac: #C7B8FF; --gold: #FFC857; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--night); color: var(--text); font: 17px/1.6 'Nunito', ui-rounded, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 32px max(20px, env(safe-area-inset-left)) 64px max(20px, env(safe-area-inset-right)); }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .mark { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 72%, #262C6E 0%, #141A48 60%, #0B0E24 100%); border: 1px solid rgba(199, 184, 255, 0.35); }
  header strong { font-size: 22px; }
  nav { display: flex; gap: 8px; margin: 0 0 24px; }
  nav a { color: var(--lilac); font-weight: 700; text-decoration: none; padding: 6px 14px; border: 1px solid var(--line); border-radius: 999px; }
  nav a:hover, nav a:focus-visible { background: var(--card); }
  h1 { font-size: clamp(28px, 6vw, 38px); line-height: 1.15; margin: 0 0 8px; text-wrap: balance; }
  h2 { font-size: 26px; margin: 40px 0 4px; }
  h3 { font-size: 19px; margin: 28px 0 6px; color: var(--lilac); }
  p, li { color: var(--soft); max-width: 65ch; }
  .meta { margin: 0; font-size: 15px; }
  .draft { margin: 14px 0 0; padding: 12px 16px; border-radius: 14px; background: #2A2340; border: 1px solid #5B4A2A; color: var(--gold); font-weight: 700; }
  section + section { margin-top: 56px; padding-top: 8px; border-top: 1px solid var(--line); }
  a { color: var(--lilac); }
  footer { margin-top: 56px; color: var(--soft); font-size: 14px; }
</style>
</head>
<body>
<div class="wrap">
  <header><span class="mark">${logo}</span><strong>MindFree</strong></header>
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
);
const home = page(
  'MindFree',
  'pt-BR',
  `<h1>Antes de dormir, fale o que está na sua cabeça. De manhã, está tudo organizado.</h1>
  <p>O MindFree é um app para iPhone e Android que transforma o que você fala à noite em tarefas com dia, horário e lembrete.</p>
  <p><a href="privacidade/">Política de privacidade</a> · <a href="privacidade/#en" hreflang="en">Privacy policy</a></p>`,
);

mkdirSync(new URL('docs/privacidade/', root), { recursive: true });
writeFileSync(new URL('docs/privacidade/index.html', root), privacy);
writeFileSync(new URL('docs/index.html', root), home);
writeFileSync(new URL('docs/.nojekyll', root), '');
writeFileSync(new URL('docs/favicon.png', root), readFileSync(new URL('assets/images/favicon.png', root)));
console.log('gerado: docs/index.html e docs/privacidade/index.html');
