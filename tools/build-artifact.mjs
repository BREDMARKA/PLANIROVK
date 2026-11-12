// Bundles the app into one HTML fragment (no <html>/<head>), the format claude.ai artifacts expect.
// Usage: node tools/build-artifact.mjs <output.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist', 'planirovk-artifact.html');
const css = readFileSync(join(root, 'app.css'), 'utf8');
const files = ['01-core.js', '02-logic.js', '03-views.js', '04-views2.js', '05-sheets.js', '06-main.js'];
const js = files.map((f) => `/* ${f} */\n` + readFileSync(join(root, 'js', f), 'utf8')).join('\n');

const html = `<title>Планировщик</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="app"></div>
<div id="sheet-root"></div>
<div id="toast-root"></div>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
